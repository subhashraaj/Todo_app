const isEmailRegex = ({ email }) =>  {
    const isEmail = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
    return isEmail;
}


const userDataValidation = ({ name, email, username, password}) => {
    return new Promise((resolve, reject) => {
        if(!username || !email || !password) reject("Data is Missing");

        if(typeof username !== "string") reject("username is not a text");
        if(typeof email !== "string") reject("email is not a text");
        if(typeof password !== "string") reject("password is not a text");

        if(username.length <3 || username.length > 20) 
            reject("Username Length should be 3-20")
        if(password.length <3 || password.length > 20) 
            reject("Password Length should be 3-20")

        if(!isEmailRegex({ email }))  reject("Emial format is incorrect")


        resolve();
    })
};

module.exports = { userDataValidation, isEmailRegex }