import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.get('/', (req, res) => {
  res.send('Multitune backend is running!');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
