package metrics

import (
	"time"
)

// AIMetricsRecorder AI指标记录器
type AIMetricsRecorder struct {
	Provider  string
	Model     string
	StartTime time.Time
}

// NewAIMetricsRecorder 创建AI指标记录器
func NewAIMetricsRecorder(provider, model string) *AIMetricsRecorder {
	return &AIMetricsRecorder{
		Provider:  provider,
		Model:     model,
		StartTime: time.Now(),
	}
}

// RecordSuccess 记录成功
func (r *AIMetricsRecorder) RecordSuccess() {
	duration := time.Since(r.StartTime).Seconds()
	AIRequestsTotal.WithLabelValues(r.Provider, r.Model, "success").Inc()
	AIRequestDuration.WithLabelValues(r.Provider, r.Model).Observe(duration)
}

// RecordFailure 记录失败
func (r *AIMetricsRecorder) RecordFailure(reason string) {
	duration := time.Since(r.StartTime).Seconds()
	AIRequestsTotal.WithLabelValues(r.Provider, r.Model, reason).Inc()
	AIRequestDuration.WithLabelValues(r.Provider, r.Model).Observe(duration)
}

// RecordRetry 记录重试
func (r *AIMetricsRecorder) RecordRetry() {
	AIRetryTotal.WithLabelValues(r.Provider, r.Model).Inc()
}

// RecordTokens 记录Token使用量
func (r *AIMetricsRecorder) RecordTokens(promptTokens, completionTokens int) {
	if promptTokens > 0 {
		AITokensTotal.WithLabelValues(r.Provider, r.Model, "prompt").Add(float64(promptTokens))
	}
	if completionTokens > 0 {
		AITokensTotal.WithLabelValues(r.Provider, r.Model, "completion").Add(float64(completionTokens))
	}
}

// RecordCost 记录估算成本
func (r *AIMetricsRecorder) RecordCost(costUSD float64) {
	if costUSD > 0 {
		AIEstimatedCost.WithLabelValues(r.Provider, r.Model).Add(costUSD)
	}
}

// RecordDecisionParse 记录决策解析结果
func RecordDecisionParse(status string) {
	AIDecisionParseTotal.WithLabelValues(status).Inc()
}

// EstimateTokenCost 估算Token成本（USD）
// 根据不同模型的定价估算
func EstimateTokenCost(provider, model string, promptTokens, completionTokens int) float64 {
	// 定价（每1M tokens的USD价格）
	// 这些价格可能需要定期更新
	type Pricing struct {
		PromptPrice     float64 // 输入价格（每1M tokens）
		CompletionPrice float64 // 输出价格（每1M tokens）
	}

	// 常见模型定价
	pricing := map[string]Pricing{
		// DeepSeek
		"deepseek-chat":       {0.14, 0.28},
		"deepseek-coder":      {0.14, 0.28},
		"deepseek-reasoner":   {0.55, 2.19},
		"deepseek/deepseek-chat": {0.14, 0.28},
		
		// Qwen
		"qwen-turbo":          {0.3, 0.6},
		"qwen-plus":           {0.8, 2.0},
		"qwen-max":            {2.4, 9.6},
		"qwen3-max":           {2.4, 9.6},
		
		// OpenAI via OpenRouter
		"openai/gpt-4o":       {2.5, 10.0},
		"openai/gpt-4o-mini":  {0.15, 0.6},
		"openai/gpt-4-turbo":  {10.0, 30.0},
		"openai/gpt-3.5-turbo": {0.5, 1.5},
		
		// Anthropic via OpenRouter
		"anthropic/claude-3.5-sonnet": {3.0, 15.0},
		"anthropic/claude-3-opus":     {15.0, 75.0},
		"anthropic/claude-3-haiku":    {0.25, 1.25},
		
		// Google via OpenRouter
		"google/gemini-pro":           {0.125, 0.375},
		"google/gemini-pro-1.5":       {1.25, 5.0},
		"google/gemini-2.0-flash-exp": {0.0, 0.0}, // 免费
		
		// Meta via OpenRouter
		"meta-llama/llama-3.1-70b-instruct": {0.52, 0.75},
		"meta-llama/llama-3.1-8b-instruct":  {0.055, 0.055},
	}

	p, ok := pricing[model]
	if !ok {
		// 默认使用中等价格估算
		p = Pricing{1.0, 2.0}
	}

	// 计算成本（价格是每1M tokens）
	promptCost := float64(promptTokens) * p.PromptPrice / 1_000_000
	completionCost := float64(completionTokens) * p.CompletionPrice / 1_000_000

	return promptCost + completionCost
}
