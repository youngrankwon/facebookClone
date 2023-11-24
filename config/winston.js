const winston = require('winston')

/** logger level */
// error:0, warn:1, info:2, http:3, verbose:4, debug: 5, silly:6 (숫자가 높을수록 위험하거나 중요한 로그)
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
})

if (process.env.NODE_ENV !== 'production') {
    // 단순히 콘솔에만 간략한 포맷으로 출력
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }))
}

module.exports = logger