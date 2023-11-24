/** 7-13 */
const express = require('express')
const morgan = require('morgan')
const winston = require('/config/winston')
const mongoose = require('mongoose')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const passport = require('passport')
const Localstrategy = require('passport-local')
const socket = require('socket.io')
const dotenv = require('dotenv')
const flash = require('connect-flash')
const Post = require('./models/Post')
const User = require('./models/User')
const helmet = require('helmet')
const hpp = require('hpp')

const port = process.env.PORT || 3000
const onlineChatUsers = {}

dotenv.config()

const postRoutes = require('./routes/posts')
const userRoutes = require('./routes/users')
const app = express()

app.set('view engine', 'ejs')

/** 미들웨어 */
if (process.env.NODE_ENV === 'production') {
    // app.enable('trust proxy')
    app.use(morgan('combined'))
    app.use(helmet({ contentSecurityPolicy: false }))
    app.use(hpp())
} else {
    app.use(morgan('dev'))
}

/** 미들웨어 */
app.use(cookieParser(process.env.SECRET))   // 암호화된 쿠키를 사용하기 위한 임의의 문자 전송

const sessOptions = {
    secret: process.env.SECRET, // 암호화된 쿠키와 세션을 사용하기 위한 임의의 문자 지정
    resave: false,              // 새로운 요청 시 세션에 변동 사항이 없어도 다시 저장할지의 여부 설정
    saveUninitialized: false,   // 세션에 저장한 내용이 없어도 저장할지의 여부 설정
    cookie: {                   // 세션 쿠키의 옵션 설정
        httpOnly: true,         // 로그인을 구현할 때 필수로 적용. js로 쿠키에 접근하지 못하게 막고 웹 서버로 오면 쿠키에 접근할 수 있도록 설정 
        secure: false,          // https 에서만 cookie 를 사용할 수 있도록 설정. 이 외 maxAge(만료 시간 설정), expires(만료 날짜 설정), path(쿠키경로), domain(도메인 이름 설정), signed(쿠키의 서명 여부 설정) 등의 옵션이 있음
    }
}
if (process.env.NODE_ENV === 'production') {
    // proxy: 보안상의 문제로 직접 클라이언트와 서버가 통신하기보다 중간에 프록시 서버를 두어 클라이언트와 서버의 중간에서 중계 역할을 해주는 것. 보안 문제 외에도 프록시 서버에 요청내용을 캐시하기 위해 사용
    // proxy 를 설정하려면 express-session 옵션의 proxy 를 true로 설정하는것과 app.enable('trust proxy') 를 통해 서버가 proxy를 허용할 수 있도록 해줘야 함
    // sessOptions.proxy = true
    // sessOptions.cookie.secure = true
}
app.use(session(sessOptions))

// app.use(session({
//     secret: process.env.SECRET,             // 암호화
//     resave: false,                          // 새로운 요청 시 세션에 변동 사항이 없어도 다시 저장할지 설정
//     saveUninitialized: false,               // 세션에 저장할 내용이 없어도 저장할지 설정
// }))
// connect-flash는 req 객체에 req.flash 라는 프로퍼티를 생성하고 req.flash(key, value) 형태로 키에 매칭된 값을 설정하고 req.flash(key)로 불러와 사용하면 된다.
app.use(flash())    // connect-flash 미들웨어는 내부적으로 cookie-parser와 express-session을 사용하므로 이 둘 위에 작성해야 함

/** passport setup */
app.use(passport.initialize())
app.use(passport.session())
passport.use(new Localstrategy(User.authenticate()))
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

/** Middlware */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))   // 정적파일들을 서비스할 폴더를 public/으로 지정

/** MongoDB Connection */
mongoose
    .connect('mongodb+srv://horany83:Eodfks$$2023@cluster0.cuwdpyy.mongodb.net/?retryWrites=true&w=majority', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => {
        console.log('connected to MongoDB')
    })
    .catch((err) => {
        winston.error(err)
    })


/** Template 파일에 변수 전송 */
app.use((req, res, next) => {
    res.locals.user = req.user
    res.locals.login = req.isAuthenticated()
    res.locals.error = req.flash('error')
    res.locals.success = req.flash('success')
    next()
})

/** Routers */
app.use('/', userRoutes)
app.use('/', postRoutes)

const server = app.listen(port, () => {
    winston.info('App is running on port ' + port)
})

/** WebSocket setup */
const io = socket(server)   //socket.io 를 이용해 websocket 통신 구현하고 http 통신을 하는 express 서버와 연결

const room = io.of('/chat')
room.on('connection', socket => {
    winston.info('new user : ', socket.id)

    room.emit('newUser', { socketID: socket.id })   // room.emit: 모든 사용자에게 메시지를 보냄
    socket.on('newUser', data => {                  // socket.on: 특정 이벤트에만 메시지를 보냄
        if (!(data.name in onlineChatUsers)) {
            onlineChatUsers[data.name] = data.socketID
            socket.name = data.name
            room.emit('updateUserList', Object.keys(onlineChatUsers))
            winston.info('Online users: ' + Object.keys(onlineChatUsers))
        }
    })

    socket.on('disconnect', () => {
        delete onlineChatUsers[socket.name]
        room.emit('updateUserList', Object.keys(onlineChatUsers))
        winston.info(`user ${socket.name} disconnected`)
    })

    socket.on('chat', data => {
        winston.info(data)
        if (data.to === 'Global Chat') {
            room.emit('chat', data)
        } else if (data.to) {
            room.to(onlineChatUsers[data.name]).emit('chat', data)
            room.to(onlineChatUsers[data.to]).emit('chat', data)
        }

    })
})