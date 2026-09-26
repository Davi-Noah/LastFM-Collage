import express from "express";
import { createApp } from "./back/createApp.js";

const app = express();
createApp(app);

export default app;
