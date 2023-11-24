const mongoose = require('mongoose')
const passportLocalMongoose = require('passport-local-mongoose')

let UserSchema = new mongoose.Schema({  // 사용자 스키마
    username: String,
    firstName: String,
    lastName: String,
    password: String,
    profile: String,
    // User Collection 에 있는 posts 필드는 Post Collectioin에 있는 Document와 매핑이 되어있음(RDB에서 외래키를 이용해 Relation을 맺어주는것과 동일함)
    posts: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post'
        }
    ],
    liked_posts: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post'
        }
    ],
    liked_comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post'
        }
    ],
    friends: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    friendRequests: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
})

// 사용자 인증을 위한 passport-local-mongoose 모듈과 스키마 연결
UserSchema.plugin(passportLocalMongoose)
let User = mongoose.model('User', UserSchema)
module.exports = User