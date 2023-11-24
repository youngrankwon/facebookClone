/** 7-25 */
const express = require('express')
const User = require('../models/User')
const passport = require('passport')
// 텍스트 정보를 저장하는 body 객체와 멀티파트 데이터를 저장하는 file 객체를 req 객체에 추가
const multer = require('multer')
const cloudinary = require('cloudinary')
const router = express.Router()
const csrf = require('csurf')
const csrfProtection = csrf({ cookie: true })

/** Multer setup */
const storage = multer.diskStorage({
    filename: (req, file, callback) => {
        callback(null, Date.now() + file.originalname)
    }
})

const imageFilter = (req, file, callback) => {
    console.log('file', file)
    // 파일의 확장자가 jpg, jpeg, png 인지 확인
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/i)) {
        return callback(new Error('Only image files are allowed!!'), false)
    }
    callback(null, true)
}

const upload = multer({ storage: storage, fileFilter: imageFilter })

/** cloudinary setup */
// 이미지를 업로드하고 불러올 공간을 빌리기 위한 SaaS 서비스
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

/** Middleware */
// 로그인하지 않은 사용자 체크. 로그인하지 않은 사용자라면 flash로 오류메시지를 보내고 리다이렉트
const isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next()
    }
    req.flash('error', 'You need to be logged in to do that!!')
    res.redirect('/user/login')
}

/** User Routers */
router.post('/user/register', upload.single('image'), (req, res) => {
    if (
        req.body.username &&
        req.body.firstname &&
        req.body.lastname &&
        req.body.password
    ) {
        let newUser = new User({
            username: req.body.username,
            firstName: req.body.firstname,
            lastName: req.body.lastname
        })
        if (req.file) {
            cloudinary.uploader.upload(req.file.path, result => {
                newUser.profile = result.secure_url
                return createUser(newUser, req.body.password, req, res)
            })
        } else {
            newUser.profile = process.env.DEFAULT_PROFILE_PIC
            return createUser(newUser, req.body.password, req, res)
        }
    }
})

function createUser(newUser, password, req, res) {
    User.register(newUser, password, (err, user) => {
        if (err) {
            req.flash('error', err.message)
            res.redirect('/')
        } else {
            passport.authenticate('local')(req, res, function () {
                console.log(req.user)
                req.flash(
                    'success',
                    "Success!! You are registered and logged in!!"
                )
                res.redirect('/')
            })
        }
    })
}

// Login
router.get('/user/login', csrfProtection, (req, res) => {
    // csrfToken과 post 요청을 보낸 사용자의 csrfToken이 같은지 확인하여 csrf 공격 방어
    res.render('users/login', { csrfToken: req.csrfToken() })   // views/users/login.ejs 파일 렌더링
})

router.post(
    '/user/login',
    csrfProtection,
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/user/login'
    }),
    (req, res) => { }
)

// All users
router.get('/user/all', isLoggedIn, (req, res) => {
    User.find({}, (err, users) => {
        if (err) {
            console.log(err)
            req.flash(
                'error',
                'There has been a problem getting all users info.'
            )
            res.redirect('/')
        } else {
            res.render('users/users', { users: users })
        }
    })
})
// Logout
router.get('/user/logout', (req, res) => {
    req.logout();
    res.redirect('back')
})

// User Profile
router.get('/user/:id/profile', isLoggedIn, (req, res) => { // 사용자 프로필 생성
    User.findById(req.params.id)    // req.params.id 로 사용자 조회
        .populate('friends')        // mongoose의 populate() 메서드를 통해 friends, friendRequests, posts 필드의 Document 를 조회
        .populate('friendRequests')
        .populate('posts')
        .exec((err, user) => {
            if (err) {
                console.log(err)
                req.flash('error', 'There has been an error.')
                res.redirect('back')
            } else {
                console.log(user)
                res.render('users/user', { userData: user })
            }
        })
})

// Add Friend
router.get('/user/:id/add', isLoggedIn, (req, res) => {
    User.findById(req.user._id, (err, user) => {
        if (err) {
            console.log(err)
            req.flash(
                'error',
                'There has been an error adding this person to your friends list'
            )
            res.redirect('back')
        } else {
            User.findById(req.params.id, (err, foundUser) => {
                if (err) {
                    console.log(err)
                    req.flash('error', 'Person not found')
                    res.redirect('back')
                } else {
                    if (
                        foundUser.friendRequests.find(o =>
                            o._id.equals(user._id)
                        )
                    ) {
                        req.flash(
                            'error',
                            `You have already sent a friend request to ${user.firstName}`
                        )
                        return res.redirect('back')
                    } else if (
                        foundUser.friends.find(o => o._id.equals(user._id))
                    ) {
                        req.flash(
                            'error',
                            `The user ${foundUser.firstname} is already in your friends list`
                        )
                        return res.redirect('back')
                    }
                    let currUser = {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName
                    }
                    foundUser.friendRequests.push(currUser)
                    foundUser.save()
                    req.flash(
                        'success',
                        `Success! You sent ${foundUser.firstName} a friend request!`
                    )
                    req.redirect('back')
                }
            })
        }
    })
})

//Accept friend request
router.get('/user/:id/accept', isLoggedIn, (req, res) => {
    User.findById(req.user._id, (err, user) => {
        if (err) {
            console.log(err)
            req.flash(
                'error',
                'There has been an error finding your profile, are you connected?'
            )
            res.redirect('back')
        } else {
            User.findById(req.params.id, (err, foundUser) => {
                let r = user.friendRequests.find(o =>
                    o._id.equals(req.params.id)
                )
                if (r) {
                    let index = user.friendRequests.indexOf(r)
                    user.friendRequests.splice(index, 1)
                    let friend = {
                        _id: foundUser._id,
                        firstName: foundUser.firstName,
                        lastName: foundUser.lastName
                    }
                    user.friends.push(friend)
                    user.save()
                    let currUser = {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName
                    }
                    foundUser.friends.push(currUser)
                    foundUser.save()
                    req.flash(
                        'success',
                        `You and ${foundUser.firstName} are now friends!!`
                    )
                    res.redirect('back')
                } else {
                    req.flash(
                        'error',
                        'There has been an error, is the profile you are trying to add on your requests?'
                    )
                    res.redirect('back')
                }
            });
        }
    })
})

// Decline friend Request
router.get('/user/:id/decline', isLoggedIn, (req, res) => {
    User.findById(req.user._id, (err, user) => {
        if (err) {
            console.log(err)
            req.flash('error', 'There has been an error declining the request')
            res.redirect('back')
        } else {
            User.findById(req.params.id, (err, foundUser) => {
                if (err) {
                    console.log(err)
                    req.flash(
                        'error',
                        'There has been an error declining the request'
                    )
                    res.redirect('back')
                } else {
                    // remove request
                    let r = user.friendRequests.find(o =>
                        o._id.equals(foundUser._id)
                    )
                    if (r) {
                        let index = user.friendRequests.indexOf(r)
                        user.friendRequests.splice(index, 1)
                        user.save()
                        req.flash('success', 'You declined')
                        res.redirect('back')
                    }
                }

            })
        }
    })
})

/** Chat Routers */
// User 컬렉션에서 user를 찾고 해당 user의 friends 값을 populate() 를 통해 접근하고 가져온 데이터를 'views/users/chat.ejs'에 보내주고 렌더링
router.get('/chat', isLoggedIn, (req, res) => {
    User.findById(req.user._id)
        .populate('friends')
        .exec((err, user) => {
            if (err) {
                console.log(err)
                req.flash(
                    'error',
                    'There has been an error trying to access the chat'
                )
                res.redirect('/')
            } else {
                res.render('users/chat', { userData: user })
            }
        })
})

// 모든 라우터를 module.exports 를 통해 app.js 에서 사용할 수 있도록 함
module.exports = router