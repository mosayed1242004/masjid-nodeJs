const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student_id : {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  attend: {
    type: String,
    required: true,
  },
  day: {
    type: Date,
    required: true
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
