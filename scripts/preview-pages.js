import express from 'express';
import { p } from '../src/paths.js';
const app = express();
const base = process.env.BASE_PATH || '/yoga-agent-store/';
app.use(base, express.static(p('dist')));
app.listen(4243, '127.0.0.1', () => console.log(`Demo preview: http://127.0.0.1:4243${base}`));
