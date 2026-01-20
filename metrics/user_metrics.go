package metrics

// RecordUserRegistration 记录用户注册
func RecordUserRegistration(status string) {
	UserRegistrationsTotal.WithLabelValues(status).Inc()
}

// RecordUserLogin 记录用户登录
func RecordUserLogin(status string) {
	UserLoginsTotal.WithLabelValues(status).Inc()
}

// RecordUserOTPVerification 记录OTP验证
func RecordUserOTPVerification(success bool) {
	status := "success"
	if !success {
		status = "failed"
	}
	UserOTPVerificationsTotal.WithLabelValues(status).Inc()
}

// UpdateUserStats 更新用户统计指标
// 这个函数应该定期调用（例如每分钟），从数据库获取最新统计
type UserStats struct {
	TotalUsers          int
	VerifiedUsers       int
	DailyActiveUsers    int
	WeeklyActiveUsers   int
	MonthlyActiveUsers  int
	TotalTraders        int
	RunningTraders      int
	NewRegistrations24h int
}

// SetUserStats 设置用户统计指标
func SetUserStats(stats UserStats) {
	UsersTotal.Set(float64(stats.TotalUsers))
	UsersVerified.Set(float64(stats.VerifiedUsers))
	UsersActiveDaily.Set(float64(stats.DailyActiveUsers))
	UsersActiveWeekly.Set(float64(stats.WeeklyActiveUsers))
	UsersActiveMonthly.Set(float64(stats.MonthlyActiveUsers))
	UserTradersTotal.Set(float64(stats.TotalTraders))
	UserTradersRunning.Set(float64(stats.RunningTraders))
	UserNewRegistrationsDaily.Set(float64(stats.NewRegistrations24h))
}
