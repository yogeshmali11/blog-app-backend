const express = require('express');
const bcrypt = require('bcrypt');
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const upload = require('./config/multerconfig');

app.set("view engine", "ejs");
// app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());


app.get('/', (req, res)=>{
    res.cookie("token", "");
    res.render("index");
});

app.get('/login', (req, res)=>{
    res.render("login");
});

// routes to add a profile pic using multer..
app.get('/profile/upload', (req, res)=>{
    res.render("profileupload");
});

app.post('/upload', isLoggedIn, upload.single("image"), async(req, res)=>{
    let user = await userModel.findOne({email: req.user.email});
    user.profilepic = req.file.filename;
    await user.save();
    res.redirect('/profile');
});

app.get('/profile', isLoggedIn, async(req, res)=>{
    // console.log(req.user);
    let user = await userModel.findOne({email: req.user.email}).populate("posts");
    let posts = await postModel.find().populate('user');
    // console.log(user);
    // user.populate("posts");
    res.render("profile", {user, posts});
});

// Functionality to like the post..
app.get('/like/:id', isLoggedIn, async(req, res)=>{
    let post = await postModel.findOne({_id: req.params.id}).populate("user");
    if(post.likes.indexOf(req.user.userid) === -1){
        post.likes.push(req.user.userid);
    }else{
        post.likes.splice(post.likes.indexOf(req.user.userid), 1);
    }
    await post.save();
    res.redirect("/profile");
});

// Functionality to edit the post..
app.get('/edit/:id', isLoggedIn, async(req, res)=>{
    let post = await postModel.findOne({_id: req.params.id}).populate("user");
    res.render("edit", {post});
});

// Functionlity to update the post..
app.post('/update/:id', isLoggedIn, async(req, res)=>{
    let post = await postModel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content});
    res.redirect("/profile");
});

// Functionality to delete the post..
app.get('/delete/:id', isLoggedIn, async(req, res)=>{
    await postModel.deleteOne({_id: req.params.id});
    res.redirect('/profile');
})

// creating new post in profile section..
app.post('/post', isLoggedIn, async(req, res)=>{
    let user = await userModel.findOne({email: req.user.email});
    let {content} = req.body;
    let post = await postModel.create({
        user: user._id,
        content
    });
    user.posts.push(post._id);
    await user.save();
    res.redirect("/profile");
})

// Middleware for protected route... (e.g: profile route..)
function isLoggedIn(req, res, next){
    if(req.cookies.token === ""){
        return res.redirect("/login");
    }else{
        let data = jwt.verify(req.cookies.token, "secret");
        req.user = data;
    }
    next();
}

app.post('/register', async(req, res)=>{
    let {username, name, email, password, age} = req.body;

    let user = await userModel.findOne({email});
    if(user) return res.status(500).send("User already registered..");

    bcrypt.genSalt(10, (err, salt)=>{
        bcrypt.hash(password, salt, async(err, hash)=>{
            let user = await userModel.create({
                username,
                name,
                email,
                age,
                password: hash
            });

            let token = jwt.sign({email: email, userid: user._id}, "secret");
            res.cookie("token", token);
            res.send("Account Created Successfully");
        })
    })
});

app.post('/login', async(req, res)=>{
    let {email, password} = req.body;

    let user = await userModel.findOne({email});
    if(!user) return res.status(500).send("Something went wrong..");

    bcrypt.compare(password, user.password, (error, result)=>{
        if(result){
            // let data = jwt.verify(req.cookies.token, "secret");
            // req.user = data;
            // res.status(200).send("You can login..");
            let token = jwt.sign({email: user.email, userid: user._id}, "secret");
            res.cookie("token", token);
            res.status(200).redirect("/profile");
        } 
        else res.redirect('/login');
    })
});

app.get('/logout', (req, res)=>{
    res.cookie("token", "");
    res.redirect('/login');
})

app.listen(3000);