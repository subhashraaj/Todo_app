const todoDataValidation = ({ todo }) => {
    // console.log(todo)
    return new Promise((resolve, reject) => {
        if(!todo) return reject("Missing todo Text");
        if(typeof todo !== "string") return reject("Todo is not a Text");
        if(todo.length < 3 || todo.length > 100) return reject("todo length should be 3-100");

        resolve();
    })
}

module.exports = { todoDataValidation }; 