package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GinMiddleware Gin中间件 - 收集HTTP请求指标
func GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 跳过 /metrics 端点本身，避免无限循环
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		// 记录开始时间
		start := time.Now()

		// 增加正在处理的请求数
		HTTPRequestsInFlight.Inc()
		defer HTTPRequestsInFlight.Dec()

		// 处理请求
		c.Next()

		// 记录指标
		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())
		path := normalizePath(c.Request.URL.Path)
		method := c.Request.Method

		// 记录请求计数
		HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()

		// 记录请求延迟
		HTTPRequestDuration.WithLabelValues(method, path).Observe(duration)
	}
}

// normalizePath 标准化路径，避免高基数问题
// 例如：/api/traders/123/config -> /api/traders/:id/config
func normalizePath(path string) string {
	// 常见的动态路径模式
	patterns := map[string]string{
		"/api/traders/":          "/api/traders/:id",
		"/api/decisions/":        "/api/decisions/:id",
		"/api/equity-history/":   "/api/equity-history/:id",
		"/api/prompt-templates/": "/api/prompt-templates/:name",
	}

	for prefix, normalized := range patterns {
		if len(path) > len(prefix) && path[:len(prefix)] == prefix {
			// 找到下一个斜杠的位置
			rest := path[len(prefix):]
			for i, c := range rest {
				if c == '/' {
					return normalized + rest[i:]
				}
			}
			return normalized
		}
	}

	return path
}

// RecordAuthLogin 记录登录指标
func RecordAuthLogin(success bool) {
	status := "success"
	if !success {
		status = "failed"
	}
	AuthLoginTotal.WithLabelValues(status).Inc()
}

// RecordJWTValidation 记录JWT验证指标
func RecordJWTValidation(status string) {
	AuthJWTValidationTotal.WithLabelValues(status).Inc()
}
