const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const validUrl = require("valid-url");
const shortid = require("shortid");
const config = require("config");

const app = express();
app.use(express.json());

const supabaseUrl = "https://ojzfkfdaupntjdpmjpaw.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const initializeDbAndServer = async () => {
  try {
    app.listen(3004, () =>
      console.log("Server Running at http://localhost:3004/")
    );
  } catch (error) {
    process.exit(1);
  }
};

initializeDbAndServer();

app.post("/register", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const supabaseData = await supabase
    .from("profiles")
    .select("username")
    .eq("username", username);
  if (!supabaseData.data.length) {
    await supabase
      .from("profiles")
      .insert([{ username, password: hashedPassword }]);

    response.send("User Created");
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const supabaseData = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username);

  if (!supabaseData.data.length) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      supabaseData.data[0].password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400).json("Invalid Password");
    }
  }
});

app.post("/shorten", async (request, response) => {
  const { longUrl } = request.body;
  const baseUrl = config.get("baseUrl");
  if (!validUrl.isUri(baseUrl)) {
    return response.status(401).json("Invalid Base URL");
  }

  const urlCode = shortid.generate();

  if (validUrl.isUri(longUrl)) {
    try {
      let urlObj = await supabase
        .from("url")
        .select("short_url")
        .eq("long_url", longUrl);

      if (urlObj.data.length) {
        response.json(urlObj.data[0]);
      } else {
        const shortUrl = baseUrl + urlCode;

        await supabase
          .from("url")
          .insert([
            { short_url: shortUrl, long_url: longUrl, url_code: urlCode },
          ]);

        response.json(shortUrl);
      }
    } catch (err) {
      console.error(err);
      response.status(500);
    }
  } else {
    response.status(401).json("Invalid URL");
  }
});

app.get("/:code", async (request, response) => {
  const { code } = request.params;
  try {
    let urlObj = await supabase
      .from("url")
      .select("long_url")
      .eq("url_code", code);
    if (urlObj.data.length) {
      response.redirect(urlObj.data[0].long_url);
    } else {
      response.status(401).json("Unknown URL");
    }
  } catch (err) {
    console.error(err);
    response.status(500);
  }
});
