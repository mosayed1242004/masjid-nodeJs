const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const auth = req.headers['Authorization'] || req.headers['authorization'];
  const token = auth.split(" ")[1];
  const verify = jwt.verify(token, process.env.JWT_SECRET_KEY);
  next();
}

module.exports = verifyToken;