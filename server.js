const express = require('express');
const multer = require('multer');
const fs = require('fs')
const { google } = require('googleapis')
const OAuth2Data = require("./client.json");

const app = express()


const CLIENT_ID = OAuth2Data.web.client_id;
const CLIENT_SECRET = OAuth2Data.web.client_secret;
const REDIRECT_URL = OAuth2Data.web.redirect_uris[0];

const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URL
);
const SCOPES =
    "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/userinfo.profile";

var authed = false;

var Storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, "./videos");
    },
    filename: function (req, file, callback) {
        callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
    },
});

var upload = multer({
    storage: Storage,
}).single("file");




app.get('/', (req, res) => {
    if (!authed) {
        var url = oAuth2Client.generateAuthUrl({
            access_type: "offline",
            scope: SCOPES,
        });
        res.send(`<a  href="${url}">Login</a>`)
    }
    else {
        var oauth2 = google.oauth2({
            auth: oAuth2Client,
            version: "v2",
        });
        oauth2.userinfo.get(function (err, response) {
            if (err) {
                console.log(err);
            } else {
                const name = response.data.name;
                const pic = response.data.picture;
                res.send(`<form action="/upload" method="POST" enctype="multipart/form-data"> 
                            <input type="text" name="title" placeholder="Title" required class="form-control">             
                            <input type="file" class="form-control" name="file" required id=""/>
                            <textarea name="description" class="form-control" cols="30" rows="10" placeholder="description"></textarea>
                            <button class="btn btn-block btn-danger">
                                Upload Video
                            </button>
                        </form>`
                )
            }
        });
    }
})
app.get('/google/callback', (req, res) => {
    const code = req.query.code
    if (code) {
        // Get an access token based on our OAuth code
        oAuth2Client.getToken(code, function (err, tokens) {
            if (err) {
                console.log("Error authenticating");
                console.log(err);
            } else {
                oAuth2Client.setCredentials(tokens);

                authed = true;
                res.redirect("/");
            }
        });
    }
})

app.post("/upload", (req, res) => {
    upload(req, res, function (err) {
        if (err) {
            console.log(err);
            return res.end("Something went wrong");
        } else {
            title = req.body.title;
            description = req.body.description;
            tags = req.body.tags;
            const youtube = google.youtube({ version: "v3", auth: oAuth2Client });
            youtube.videos.insert(
                {
                    resource: {
                        // Video title and description
                        snippet: {
                            title: title,
                            description: description,
                            tags: tags
                        },
                        status: {
                            privacyStatus: "private",
                        },
                    },
                    // This is for the callback function
                    part: "snippet,status",

                    // Create the readable stream to upload the video
                    media: {
                        body: fs.createReadStream(req.file.path)
                    },
                },
                (err, data) => {
                    if (err) throw err
                    fs.unlinkSync(req.file.path);
                    res.json(`https://www.youtube.com/watch?v=${data.data.id}`)
                }
            );
        }
    });
});

app.listen(5000, () => {
    console.log(`Server is listening on port: 5000`)
})