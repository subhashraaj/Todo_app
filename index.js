const express = require("express");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
require("dotenv").config();
const bcrypt = require("bcryptjs");
const session = require("express-session");
const mongoDbSession = require("connect-mongodb-session")(session)


//file-import
const { userDataValidation, isEmailRegex }  = require("./utils/authUtils");
const { todoDataValidation } = require("./utils/todoUtils")
const userModel = require("./models/userModel");
const { isAuth } = require("./middlewares/authMiddleWare");
const todoModel = require("./models/todoModel");


//constants
const app = express();
const PORT = process.env.PORT;
const store = new mongoDbSession({
    uri: process.env.MONGO_URI,
    collection: "sessions"
})

//middlewares
//setting ejs
app.set("view engine", "ejs");
//To get the inputs
app.use(express.urlencoded({ extended: true }))
app.use(express.json());
app.use(
    session({
        secret: process.env.SECRET_KEY,
        resave: false,
        saveUninitialized: false,
        store,
    }))

app.use(express.static("public"));
//db Connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("mongodb Connected")
    })
    .catch((err) => {
        console.log(err)
    });

//api

app.get("/", (req, res) => {
    return res.render("homePage")
});

app.get("/register", (req, res) => {
    return res.render("registerPage")
});

app.post("/register", async(req,res) => {

    const { name, email, username, password} = req.body;

    //Data Validation
    try{
        await userDataValidation ({ name, email, username, password});
    }catch(err) {
        return res.status(400).json(err)
    }
    //hased the password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALT))

    const userObj = new userModel({
        name, 
        email, 
        username, 
        password: hashedPassword,

    });
    console.log(userObj);
    //email  exist or not
    const userEmailExist = await userModel.findOne({ email })
    
    if(userEmailExist){
        return res.send ({
            status: 400,
            message: "Email already Exist, Please Log In"
        })}
    //username exist or not
    const userNameExist = await userModel.findOne({ username })
    if(userNameExist){
        return res.send ({
            status: 400,
            message: "Username already Exist, Please Log In"
        })
    }
    try{
        const userDb = await userObj.save();
        return res.redirect("/login")
    }catch(err){
        return res.send({
            status: 500,
            message: "Internal Server Error",
            error: err,
        })
    }
});

app.get("/login", (req, res) => {
    return res.render("loginPage")
});

app.post("/login", async (req,res) => {
    //data validation 
    //console.log(req.body)
    const {loginId, password} = req.body;

    if(!loginId || !password) return ({
        status: 400,
        message: ("Missing Credentials")
    });

    //find user With Loginid
    try
    {
        let userDb;
        //console.log(isEmailRegex({email: loginId}))
        if(isEmailRegex({email: loginId})){
            userDb = await userModel.findOne({ email: loginId })
        }
        else{
            userDb = await userModel.findOne({username: loginId})
        }

        if(!userDb){
            return res.render("userNotFound")
        }
        //console.log(password===userDb.password)   

        //Compare password using Bcrypt

        const isMatch = await bcrypt.compare(password, userDb.password)
        if(!isMatch) return res.status(400).json("Password Does not match")

        req.session.isAuth = true; //storing session in db

        req.session.user = {
            userId: userDb._id,
            username: userDb.username,
            password: userDb.password,
        }
        //console.log(req.session.id)
        return res.redirect("/dashboard")
        
    }
    catch(error){
        console.log(error)
        return res.send({
            status : 500,
            message: "Internal Server Error"
        }) 
    }
});

// app.get("/check", isAuth, (req, res,) => {
//     return res.send("API working")

// })

app.post("/logout", isAuth, (req, res) => {
    req.session.destroy((err) => {
        if(err){
            return res.send({
                status:500,
                message: "Logout Unsucessfull"
            })}
    })
    return res.redirect("/login")
});

app.post("/logout_from_all_devices", isAuth, async (req, res) => {
    const username = req.session.user.username;

    const sessionSchema = new Schema ({id: String}, {strict : false});
    const sessionModel = mongoose.model("session", sessionSchema);
    try{
        const deleteDb = await sessionModel.deleteMany({
            "session.user.username" : username,

            });
            return res.redirect("/login")

    }
    catch(error){
        return res.send({
            status: 500,
            message: "Internal server error",
            error: error
        })
    }
});

app.get("/dashboard", isAuth, (req, res) => {
    return res.render("dashboard")
});

//create item in todo
app.post("/create-item", isAuth,  async(req, res) => {

    const todoText = req.body.todo
    const username = req.session.user.username
    //data validation
    if(!todoText) {
        return res.send({status: 400, message: "Missing Todo Text"})
    }else if(typeof todoText !== "string"){ 
        return res.send({status: 400, message: "Todo is not a Text"})
    }else if(todoText.length < 3 || todoText.length > 100){
        return res.send({status: 400, message: "Todo Text length should be 3-100"})
    }
    const todoObj = new todoModel({
        todo: todoText,
        username: username,
    });
    try{
        const todoDb = await todoObj.save()
        return res.send({
            status: 201,
            message: "Todo created sucessfully",
            data: todoDb
        })
    }
    catch(error){
        return res.send({
            status: 500,
            message: "Internal Server error",
            error: error
        })
    }
});

//read item in todo
//read-item?skip=10
app.get("/read-item", isAuth, async(req, res) => {
    const username = req.session.user.username;
    const SKIP = Number(req.query.skip) || 0;
    const LIMIT = 3;

    
    try {   

        // mongoDb aggregate
        // Match, Pagination

        const todoDb = await todoModel.aggregate([
            {
                $match: { username: username }
            },
            {
                $facet: { 
                    data: [{ $skip: SKIP}, { $limit: LIMIT}]
                }
            }
        ]) 

        console.log(todoDb[0].data);
        if(todoDb[0].data.length === 0){
            return res.send({
                status: 400,
                message: "No Todo Found"
            })
        }

        return res.send({
            status: 200,
            message: "Read Sucess",
            data: todoDb[0].data
        })
    } catch (error) {
        return res.send({
            status: 500,
            message: "Internal Server error",
            error: error
        })
    }
})

//edit todo

    //find todo
    //compare the user
    //edit todo

app.post("/edit-item", isAuth, async(req, res) => {
    const { todoId, newData } = req.body;
    const username = req.session.user.username;
    //console.log(todoId, newData, username)

    try{
        await todoDataValidation({ todo: newData })
    }catch(error){
        return res.send({
            status: 400,
            message: error,
        })
    }

    try {
        const todoDb = await todoModel.findById({ _id : todoId})
        console.log(todoDb)

        if (!todoDb)
        return res.send({
          status: 400,
          message: "Todo not found",
        });

        if(todoDb.username !== username){
            res.send({
                status: 403,
                message: "You are forbidden to edit data",
            })
        }  

        const prevTodo = await todoModel.findOneAndUpdate(
            { _id: todoId }, 
            { todo: newData }
        );

        return res.send({
            status: 200,
            message: "Edit sucess",
            data: prevTodo,
        })
    } catch (error) {
        console.log(error)

        return res.send({
            status: 500,
            message: "Internal Server error",
            error: error
        })
    
    }

})

app.post("/delete-item", isAuth, async(req, res) => {
    const todoId = req.body.todoId;
    const username = req.session.user.username;
    //console.log(id, username)

    if(!todoId){
        return res.send({
            status: 400,
            message: "Missing Todo"
        })
    }

    try {
        const todoDb = await todoModel.findOne({ _id: todoId })
        //console.log(todoDb);

        if(!username){
            return res.send({
                status: 403,
                message: "Not authorized activity"
            })
        }
        
        const todoPrev = await todoModel.findOneAndDelete({ _id : todoId})

        return res.send({
            status: 200,
            message: "Todo Deleted Sucessfully",
            data: todoPrev
        });
        
    } catch (error) {
        return res.send({
            status: 500,
            message: "Database error",
            error: error
        })
    }



    
})


//listener of port
app.listen(PORT, () => {
    console.log(`Server is running on PORT: ${PORT}`);
});
