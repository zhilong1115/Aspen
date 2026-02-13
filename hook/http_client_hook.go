package hook

import (
	"github.com/rs/zerolog/log"
	"net/http"
)

type SetHttpClientResult struct {
	Err    error
	Client *http.Client
}

func (r *SetHttpClientResult) Error() error {
	if r.Err != nil {
		log.Warn().Msgf("⚠️ 执行NewAsterTraderResult时出错: %v", r.Err)
	}
	return r.Err
}

func (r *SetHttpClientResult) GetResult() *http.Client {
	r.Error()
	return r.Client
}
