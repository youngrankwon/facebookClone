const mongoose = require('mongoose')

// creator, comments 속성은 User 컬렉션의 Document와 Comment 컬렉션의 Document와 매핑
let PostSchema = new mongoose.Schema({  //게시물 스키마
    content: String,
    time: Date,
    likes: Number,
    image: String,
    creator: {
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        firstName: String,
        lastName: String,
        profile: String
    },
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }]
})

let Post = mongoose.model('Post', PostSchema)
module.exports = Post