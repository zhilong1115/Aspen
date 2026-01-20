package metrics

import (
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Version 应用版本（可在编译时注入）
var Version = "dev"

// Init 初始化metrics
func Init() {
	// 记录应用信息
	AppInfo.WithLabelValues(Version, runtime.Version()).Set(1)
	
	// 记录启动时间
	AppStartTime.Set(float64(time.Now().Unix()))
}

// Handler 返回Prometheus metrics处理器
func Handler() gin.HandlerFunc {
	h := promhttp.HandlerFor(
		prometheus.DefaultGatherer,
		promhttp.HandlerOpts{
			EnableOpenMetrics: true,
		},
	)
	
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
