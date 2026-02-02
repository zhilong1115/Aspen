package mcp

import (
	"aspen/metrics"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// Provider AI提供商类型
type Provider string

const (
	ProviderDeepSeek   Provider = "deepseek"
	ProviderQwen       Provider = "qwen"
	ProviderOpenRouter Provider = "openrouter"
	ProviderAnthropic  Provider = "anthropic"
	ProviderOpenAI     Provider = "openai"
	ProviderGoogle     Provider = "google"
	ProviderCustom     Provider = "custom"
)

// Client AI API配置
type Client struct {
	Provider   Provider
	APIKey     string
	BaseURL    string
	Model      string
	Timeout    time.Duration
	UseFullURL bool // 是否使用完整URL（不添加/chat/completions）
	MaxTokens  int  // AI响应的最大token数
}

func New() *Client {
	// 从环境变量读取 MaxTokens，默认 8192
	maxTokens := 8192
	if envMaxTokens := os.Getenv("AI_MAX_TOKENS"); envMaxTokens != "" {
		if parsed, err := strconv.Atoi(envMaxTokens); err == nil && parsed > 0 {
			maxTokens = parsed
			log.Printf("🔧 [MCP] 使用环境变量 AI_MAX_TOKENS: %d", maxTokens)
		} else {
			log.Printf("⚠️  [MCP] 环境变量 AI_MAX_TOKENS 无效 (%s)，使用默认值: %d", envMaxTokens, maxTokens)
		}
	}

	// 默认配置
	return &Client{
		Provider:  ProviderDeepSeek,
		BaseURL:   "https://api.deepseek.com/v1",
		Model:     "deepseek-chat",
		Timeout:   180 * time.Second, // 增加到180秒，因为AI需要分析大量数据
		MaxTokens: maxTokens,
	}
}

// SetDeepSeekAPIKey 设置DeepSeek API密钥
// customURL 为空时使用默认URL，customModel 为空时使用默认模型
func (client *Client) SetDeepSeekAPIKey(apiKey string, customURL string, customModel string) {
	client.Provider = ProviderDeepSeek
	client.APIKey = apiKey
	if customURL != "" {
		client.BaseURL = customURL
		log.Printf("🔧 [MCP] DeepSeek 使用自定义 BaseURL: %s", customURL)
	} else {
		client.BaseURL = "https://api.deepseek.com/v1"
		log.Printf("🔧 [MCP] DeepSeek 使用默认 BaseURL: %s", client.BaseURL)
	}
	if customModel != "" {
		client.Model = customModel
		log.Printf("🔧 [MCP] DeepSeek 使用自定义 Model: %s", customModel)
	} else {
		client.Model = "deepseek-chat"
		log.Printf("🔧 [MCP] DeepSeek 使用默认 Model: %s", client.Model)
	}
	// 打印 API Key 的前后各4位用于验证
	if len(apiKey) > 8 {
		log.Printf("🔧 [MCP] DeepSeek API Key: %s...%s", apiKey[:4], apiKey[len(apiKey)-4:])
	}
}

// SetQwenAPIKey 设置阿里云Qwen API密钥
// customURL 为空时使用默认URL，customModel 为空时使用默认模型
func (client *Client) SetQwenAPIKey(apiKey string, customURL string, customModel string) {
	client.Provider = ProviderQwen
	client.APIKey = apiKey
	if customURL != "" {
		client.BaseURL = customURL
		log.Printf("🔧 [MCP] Qwen 使用自定义 BaseURL: %s", customURL)
	} else {
		client.BaseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
		log.Printf("🔧 [MCP] Qwen 使用默认 BaseURL: %s", client.BaseURL)
	}
	if customModel != "" {
		client.Model = customModel
		log.Printf("🔧 [MCP] Qwen 使用自定义 Model: %s", customModel)
	} else {
		client.Model = "qwen3-max"
		log.Printf("🔧 [MCP] Qwen 使用默认 Model: %s", client.Model)
	}
	// 打印 API Key 的前后各4位用于验证
	if len(apiKey) > 8 {
		log.Printf("🔧 [MCP] Qwen API Key: %s...%s", apiKey[:4], apiKey[len(apiKey)-4:])
	}
}

// SetOpenRouterAPIKey 设置OpenRouter API密钥
// modelName 为要使用的模型名称，例如 "openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-pro" 等
// 如果 modelName 为空，则使用默认模型 "openai/gpt-4o"
func (client *Client) SetOpenRouterAPIKey(apiKey string, modelName string) {
	client.Provider = ProviderOpenRouter
	client.APIKey = apiKey
	client.BaseURL = "https://openrouter.ai/api/v1"
	client.UseFullURL = false // OpenRouter 使用标准路径 /chat/completions

	if modelName != "" {
		client.Model = modelName
		log.Printf("🔧 [MCP] OpenRouter 使用模型: %s", modelName)
	} else {
		client.Model = "openai/gpt-4o"
		log.Printf("🔧 [MCP] OpenRouter 使用默认模型: %s", client.Model)
	}

	client.Timeout = 180 * time.Second

	// 打印 API Key 的前后各4位用于验证
	if len(apiKey) > 8 {
		log.Printf("🔧 [MCP] OpenRouter API Key: %s...%s", apiKey[:4], apiKey[len(apiKey)-4:])
	}
}

// SetAnthropicAPIKey 设置Anthropic (Claude) API密钥
// modelName 为空时使用默认模型 claude-sonnet-4-20250514
func (client *Client) SetAnthropicAPIKey(apiKey string, modelName string) {
	client.Provider = ProviderAnthropic
	client.APIKey = apiKey
	client.BaseURL = "https://api.anthropic.com/v1"
	client.UseFullURL = false

	if modelName != "" {
		client.Model = modelName
		log.Printf("🔧 [MCP] Anthropic 使用模型: %s", modelName)
	} else {
		client.Model = "claude-sonnet-4-20250514"
		log.Printf("🔧 [MCP] Anthropic 使用默认模型: %s", client.Model)
	}

	client.Timeout = 180 * time.Second

	if len(apiKey) > 8 {
		log.Printf("🔧 [MCP] Anthropic API Key: %s...%s", apiKey[:4], apiKey[len(apiKey)-4:])
	}
}

// SetOpenAIAPIKey 设置OpenAI (GPT) API密钥
// modelName 为空时使用默认模型 gpt-4o
func (client *Client) SetOpenAIAPIKey(apiKey string, modelName string) {
	client.Provider = ProviderOpenAI
	client.APIKey = apiKey
	client.BaseURL = "https://api.openai.com/v1"
	client.UseFullURL = false

	if modelName != "" {
		client.Model = modelName
		log.Printf("🔧 [MCP] OpenAI 使用模型: %s", modelName)
	} else {
		client.Model = "gpt-4o"
		log.Printf("🔧 [MCP] OpenAI 使用默认模型: %s", client.Model)
	}

	client.Timeout = 180 * time.Second

	if len(apiKey) > 8 {
		log.Printf("🔧 [MCP] OpenAI API Key: %s...%s", apiKey[:4], apiKey[len(apiKey)-4:])
	}
}

// SetGoogleAPIKey 设置Google (Gemini) API密钥
// modelName 为空时使用默认模型 gemini-2.0-flash
func (client *Client) SetGoogleAPIKey(apiKey string, modelName string) {
	client.Provider = ProviderGoogle
	client.APIKey = apiKey
	client.BaseURL = "https://generativelanguage.googleapis.com/v1beta"
	client.UseFullURL = true // Google API 使用不同的路径格式

	if modelName != "" {
		client.Model = modelName
		log.Printf("🔧 [MCP] Google 使用模型: %s", modelName)
	} else {
		client.Model = "gemini-2.0-flash"
		log.Printf("🔧 [MCP] Google 使用默认模型: %s", client.Model)
	}

	client.Timeout = 180 * time.Second

	if len(apiKey) > 8 {
		log.Printf("🔧 [MCP] Google API Key: %s...%s", apiKey[:4], apiKey[len(apiKey)-4:])
	}
}

// SetCustomAPI 设置自定义OpenAI兼容API
func (client *Client) SetCustomAPI(apiURL, apiKey, modelName string) {
	client.Provider = ProviderCustom
	client.APIKey = apiKey

	// 检查URL是否以#结尾，如果是则使用完整URL（不添加/chat/completions）
	if strings.HasSuffix(apiURL, "#") {
		client.BaseURL = strings.TrimSuffix(apiURL, "#")
		client.UseFullURL = true
	} else {
		client.BaseURL = apiURL
		client.UseFullURL = false
	}

	client.Model = modelName
	client.Timeout = 180 * time.Second
}

// SetClient 设置完整的AI配置（高级用户）
func (client *Client) SetClient(newClient Client) {
	if newClient.Timeout == 0 {
		newClient.Timeout = 30 * time.Second
	}
	*client = newClient
}

// CallWithMessages 使用 system + user prompt 调用AI API（推荐）
func (client *Client) CallWithMessages(systemPrompt, userPrompt string) (string, error) {
	if client.APIKey == "" {
		return "", fmt.Errorf("AI API密钥未设置，请先调用 SetDeepSeekAPIKey()、SetQwenAPIKey()、SetOpenRouterAPIKey() 或 SetCustomAPI()")
	}

	// 创建指标记录器
	metricsRecorder := metrics.NewAIMetricsRecorder(string(client.Provider), client.Model)

	// 重试配置
	maxRetries := 3
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		if attempt > 1 {
			fmt.Printf("⚠️  AI API调用失败，正在重试 (%d/%d)...\n", attempt, maxRetries)
			metricsRecorder.RecordRetry()
		}

		result, err := client.callOnce(systemPrompt, userPrompt)
		if err == nil {
			if attempt > 1 {
				fmt.Printf("✓ AI API重试成功\n")
			}
			// 记录成功
			metricsRecorder.RecordSuccess()
			return result, nil
		}

		lastErr = err
		// 如果不是网络错误，不重试
		if !isRetryableError(err) {
			metricsRecorder.RecordFailure("error")
			return "", err
		}

		// 重试前等待
		if attempt < maxRetries {
			waitTime := time.Duration(attempt) * 2 * time.Second
			fmt.Printf("⏳ 等待%v后重试...\n", waitTime)
			time.Sleep(waitTime)
		}
	}

	// 记录最终失败
	if strings.Contains(strings.ToLower(lastErr.Error()), "timeout") {
		metricsRecorder.RecordFailure("timeout")
	} else {
		metricsRecorder.RecordFailure("failed")
	}

	return "", fmt.Errorf("重试%d次后仍然失败: %w", maxRetries, lastErr)
}

// callOnce 单次调用AI API（内部使用）
func (client *Client) callOnce(systemPrompt, userPrompt string) (string, error) {
	// 打印当前 AI 配置
	log.Printf("📡 [MCP] AI 请求配置:")
	log.Printf("   Provider: %s", client.Provider)
	log.Printf("   BaseURL: %s", client.BaseURL)
	log.Printf("   Model: %s", client.Model)
	log.Printf("   UseFullURL: %v", client.UseFullURL)
	if len(client.APIKey) > 8 {
		log.Printf("   API Key: %s...%s", client.APIKey[:4], client.APIKey[len(client.APIKey)-4:])
	}

	// 根据 Provider 选择不同的 API 调用方式
	switch client.Provider {
	case ProviderAnthropic:
		return client.callAnthropic(systemPrompt, userPrompt)
	case ProviderGoogle:
		return client.callGoogle(systemPrompt, userPrompt)
	default:
		// OpenAI-compatible API (DeepSeek, Qwen, OpenRouter, OpenAI, Custom)
		return client.callOpenAICompatible(systemPrompt, userPrompt)
	}
}

// callOpenAICompatible 调用 OpenAI 兼容 API（DeepSeek, Qwen, OpenRouter, OpenAI, Custom）
func (client *Client) callOpenAICompatible(systemPrompt, userPrompt string) (string, error) {
	// 构建 messages 数组
	messages := []map[string]string{}

	// 如果有 system prompt，添加 system message
	if systemPrompt != "" {
		messages = append(messages, map[string]string{
			"role":    "system",
			"content": systemPrompt,
		})
	}

	// 添加 user message
	messages = append(messages, map[string]string{
		"role":    "user",
		"content": userPrompt,
	})

	// 构建请求体
	requestBody := map[string]interface{}{
		"model":       client.Model,
		"messages":    messages,
		"temperature": 0.5, // 降低temperature以提高JSON格式稳定性
		"max_tokens":  client.MaxTokens,
	}

	// 注意：response_format 参数仅 OpenAI 支持，DeepSeek/Qwen 不支持
	// 我们通过强化 prompt 和后处理来确保 JSON 格式正确

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("序列化请求失败: %w", err)
	}

	// 创建HTTP请求
	var url string
	if client.UseFullURL {
		// 使用完整URL，不添加/chat/completions
		url = client.BaseURL
	} else {
		// 默认行为：添加/chat/completions
		url = fmt.Sprintf("%s/chat/completions", client.BaseURL)
	}
	log.Printf("📡 [MCP] 请求 URL: %s", url)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// 根据不同的Provider设置认证方式
	switch client.Provider {
	case ProviderDeepSeek:
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.APIKey))
	case ProviderQwen:
		// 阿里云Qwen使用API-Key认证
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.APIKey))
		// 注意：如果使用的不是兼容模式，可能需要不同的认证方式
	case ProviderOpenRouter:
		// OpenRouter 使用 Bearer 认证，并需要设置 HTTP-Referer 和 X-Title 头部（可选但推荐）
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.APIKey))
		req.Header.Set("HTTP-Referer", "https://github.com/aspen") // 可选：用于统计
		req.Header.Set("X-Title", "Aspen Trading Bot")             // 可选：用于标识应用
	default:
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", client.APIKey))
	}

	// 发送请求（使用带超时的HTTP客户端）
	// 注意：http.Client.Timeout 包括连接、发送请求和读取响应的总时间
	httpClient := &http.Client{
		Timeout: client.Timeout,
	}

	// 使用 context 包装请求，确保整个请求过程（包括读取响应）都有超时保护
	ctx, cancel := context.WithTimeout(context.Background(), client.Timeout)
	defer cancel()
	req = req.WithContext(ctx)

	resp, err := httpClient.Do(req)
	if err != nil {
		// 检查是否是超时错误
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("请求超时（%v）: %w", client.Timeout, err)
		}
		return "", fmt.Errorf("发送请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 读取响应（使用带超时的 context 控制）
	// 由于 http.Client.Timeout 已经包含了读取时间，这里主要是为了更好的错误处理
	type readResult struct {
		data []byte
		err  error
	}
	resultChan := make(chan readResult, 1)

	go func() {
		data, err := io.ReadAll(resp.Body)
		resultChan <- readResult{data: data, err: err}
	}()

	var body []byte
	select {
	case result := <-resultChan:
		body = result.data
		err = result.err
		if err != nil {
			return "", fmt.Errorf("读取响应失败: %w", err)
		}
	case <-ctx.Done():
		return "", fmt.Errorf("读取响应超时（%v）: %w", client.Timeout, ctx.Err())
	}

	if resp.StatusCode != http.StatusOK {
		// 记录失败指标
		metrics.AIRequestsTotal.WithLabelValues(string(client.Provider), client.Model, "failed").Inc()
		return "", fmt.Errorf("API返回错误 (status %d): %s", resp.StatusCode, string(body))
	}

	// 解析响应（包含token使用量）
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		metrics.AIRequestsTotal.WithLabelValues(string(client.Provider), client.Model, "parse_error").Inc()
		return "", fmt.Errorf("解析响应失败: %w", err)
	}

	if len(result.Choices) == 0 {
		metrics.AIRequestsTotal.WithLabelValues(string(client.Provider), client.Model, "empty_response").Inc()
		return "", fmt.Errorf("API返回空响应")
	}

	// 记录Token使用量指标
	if result.Usage.PromptTokens > 0 || result.Usage.CompletionTokens > 0 {
		metrics.AITokensTotal.WithLabelValues(string(client.Provider), client.Model, "prompt").Add(float64(result.Usage.PromptTokens))
		metrics.AITokensTotal.WithLabelValues(string(client.Provider), client.Model, "completion").Add(float64(result.Usage.CompletionTokens))
		
		// 估算并记录成本
		cost := metrics.EstimateTokenCost(string(client.Provider), client.Model, result.Usage.PromptTokens, result.Usage.CompletionTokens)
		if cost > 0 {
			metrics.AIEstimatedCost.WithLabelValues(string(client.Provider), client.Model).Add(cost)
		}
		
		log.Printf("📊 [MCP] Token使用: prompt=%d, completion=%d, total=%d, 估算成本=$%.6f",
			result.Usage.PromptTokens, result.Usage.CompletionTokens, result.Usage.TotalTokens, cost)
	}

	return result.Choices[0].Message.Content, nil
}

// isRetryableError 判断错误是否可重试
func isRetryableError(err error) bool {
	errStr := err.Error()
	// 网络错误、超时、EOF等可以重试
	retryableErrors := []string{
		"EOF",
		"timeout",
		"Timeout",
		"deadline exceeded",
		"context deadline exceeded",
		"context cancellation",
		"connection reset",
		"connection refused",
		"temporary failure",
		"no such host",
		"stream error",   // HTTP/2 stream 错误
		"INTERNAL_ERROR", // 服务端内部错误
		"i/o timeout",
		"read: connection reset",
	}
	for _, retryable := range retryableErrors {
		if strings.Contains(strings.ToLower(errStr), strings.ToLower(retryable)) {
			return true
		}
	}
	return false
}

// callAnthropic 调用 Anthropic (Claude) Messages API
func (client *Client) callAnthropic(systemPrompt, userPrompt string) (string, error) {
	// Anthropic Messages API 格式
	// https://docs.anthropic.com/en/api/messages
	requestBody := map[string]interface{}{
		"model":      client.Model,
		"max_tokens": client.MaxTokens,
		"messages": []map[string]string{
			{"role": "user", "content": userPrompt},
		},
	}

	// Anthropic 的 system prompt 是顶级参数，不在 messages 里
	if systemPrompt != "" {
		requestBody["system"] = systemPrompt
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("序列化请求失败: %w", err)
	}

	url := fmt.Sprintf("%s/messages", client.BaseURL)
	log.Printf("📡 [MCP] Anthropic 请求 URL: %s", url)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}

	// Anthropic 特殊头部
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", client.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	// 发送请求
	httpClient := &http.Client{Timeout: client.Timeout}
	ctx, cancel := context.WithTimeout(context.Background(), client.Timeout)
	defer cancel()
	req = req.WithContext(ctx)

	resp, err := httpClient.Do(req)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("请求超时（%v）: %w", client.Timeout, err)
		}
		return "", fmt.Errorf("发送请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		metrics.AIRequestsTotal.WithLabelValues(string(client.Provider), client.Model, "failed").Inc()
		return "", fmt.Errorf("API返回错误 (status %d): %s", resp.StatusCode, string(body))
	}

	// 解析 Anthropic 响应格式
	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		metrics.AIRequestsTotal.WithLabelValues(string(client.Provider), client.Model, "parse_error").Inc()
		return "", fmt.Errorf("解析响应失败: %w", err)
	}

	if len(result.Content) == 0 {
		metrics.AIRequestsTotal.WithLabelValues(string(client.Provider), client.Model, "empty_response").Inc()
		return "", fmt.Errorf("API返回空响应")
	}

	// 记录Token使用量
	if result.Usage.InputTokens > 0 || result.Usage.OutputTokens > 0 {
		metrics.AITokensTotal.WithLabelValues(string(client.Provider), client.Model, "prompt").Add(float64(result.Usage.InputTokens))
		metrics.AITokensTotal.WithLabelValues(string(client.Provider), client.Model, "completion").Add(float64(result.Usage.OutputTokens))

		cost := metrics.EstimateTokenCost(string(client.Provider), client.Model, result.Usage.InputTokens, result.Usage.OutputTokens)
		if cost > 0 {
			metrics.AIEstimatedCost.WithLabelValues(string(client.Provider), client.Model).Add(cost)
		}

		log.Printf("📊 [MCP] Token使用: input=%d, output=%d, 估算成本=$%.6f",
			result.Usage.InputTokens, result.Usage.OutputTokens, cost)
	}

	// 提取文本内容
	for _, content := range result.Content {
		if content.Type == "text" {
			return content.Text, nil
		}
	}

	return "", fmt.Errorf("未找到文本响应")
}

// callGoogle 调用 Google (Gemini) Generative AI API
func (client *Client) callGoogle(systemPrompt, userPrompt string) (string, error) {
	// Google Gemini API 格式
	// https://ai.google.dev/gemini-api/docs/text-generation

	// 构建 contents
	contents := []map[string]interface{}{
		{
			"role": "user",
			"parts": []map[string]string{
				{"text": userPrompt},
			},
		},
	}

	requestBody := map[string]interface{}{
		"contents": contents,
		"generationConfig": map[string]interface{}{
			"temperature":     0.5,
			"maxOutputTokens": client.MaxTokens,
		},
	}

	// Google 的 system instruction 是单独的参数
	if systemPrompt != "" {
		requestBody["systemInstruction"] = map[string]interface{}{
			"parts": []map[string]string{
				{"text": systemPrompt},
			},
		}
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("序列化请求失败: %w", err)
	}

	// Google API URL 格式: /models/{model}:generateContent?key={apiKey}
	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", client.BaseURL, client.Model, client.APIKey)
	log.Printf("📡 [MCP] Google 请求 URL: %s/models/%s:generateContent?key=***", client.BaseURL, client.Model)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// 发送请求
	httpClient := &http.Client{Timeout: client.Timeout}
	ctx, cancel := context.WithTimeout(context.Background(), client.Timeout)
	defer cancel()
	req = req.WithContext(ctx)

	resp, err := httpClient.Do(req)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("请求超时（%v）: %w", client.Timeout, err)
		}
		return "", fmt.Errorf("发送请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		metrics.AIRequestsTotal.WithLabelValues(string(client.Provider), client.Model, "failed").Inc()
		return "", fmt.Errorf("API返回错误 (status %d): %s", resp.StatusCode, string(body))
	}

	// 解析 Google Gemini 响应格式
	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
			TotalTokenCount      int `json:"totalTokenCount"`
		} `json:"usageMetadata"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		metrics.AIRequestsTotal.WithLabelValues(string(client.Provider), client.Model, "parse_error").Inc()
		return "", fmt.Errorf("解析响应失败: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		metrics.AIRequestsTotal.WithLabelValues(string(client.Provider), client.Model, "empty_response").Inc()
		return "", fmt.Errorf("API返回空响应")
	}

	// 记录Token使用量
	if result.UsageMetadata.PromptTokenCount > 0 || result.UsageMetadata.CandidatesTokenCount > 0 {
		metrics.AITokensTotal.WithLabelValues(string(client.Provider), client.Model, "prompt").Add(float64(result.UsageMetadata.PromptTokenCount))
		metrics.AITokensTotal.WithLabelValues(string(client.Provider), client.Model, "completion").Add(float64(result.UsageMetadata.CandidatesTokenCount))

		cost := metrics.EstimateTokenCost(string(client.Provider), client.Model, result.UsageMetadata.PromptTokenCount, result.UsageMetadata.CandidatesTokenCount)
		if cost > 0 {
			metrics.AIEstimatedCost.WithLabelValues(string(client.Provider), client.Model).Add(cost)
		}

		log.Printf("📊 [MCP] Token使用: prompt=%d, completion=%d, total=%d, 估算成本=$%.6f",
			result.UsageMetadata.PromptTokenCount, result.UsageMetadata.CandidatesTokenCount,
			result.UsageMetadata.TotalTokenCount, cost)
	}

	return result.Candidates[0].Content.Parts[0].Text, nil
}
