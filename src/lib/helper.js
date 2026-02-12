const { Buffer } = require("buffer");
const api = require("./api");
const jwt = require("jsonwebtoken");
const { isExpired } = require("./ceck");

function serializeBook(book) {
  if (book?.series?.videos) {
    book.series.videos = book.series.videos.map((v) => ({
      ...v,
      expireTime: Number(v.expireTime || 0),
    }));
  }
  return book;
}

const serializeVideos = (videos = []) =>
  videos.map((v) => ({
    ...v,
    expireTime: Number(v.expireTime || 0),
  }));

function serializeBigInt(data) {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

const decode = (url) => {
  return Buffer.from(url, "base64").toString("utf-8");
};

async function getValidStream(vid, oldVideo) {
  if (oldVideo && !isExpired(oldVideo.expire_time)) {
    return oldVideo;
  }

  // expired → regenerate
  const stream = await api.get(`/stream/${vid}`, {
    maxRedirects: 5,
    validateStatus: () => true,
  });
  const model = stream.data.data;
  const video = JSON.parse(model?.video_model).video_list;

  const resolution = {
    "240p": decode(video.video_1?.main_url),
    "380p": decode(video.video_2?.main_url),
    "480p": decode(video.video_3?.main_url),
    "540p": decode(video.video_4?.main_url),
    "720p": decode(video.video_5?.main_url),
  };

  return {
    mainUrl: model?.main_url,
    backupUrl: model?.backup_url,
    expireTime: Number(model?.expire_time),
    videoHeight: model?.video_height,
    videoWidth: model?.video_width,
    resolution: JSON.stringify(resolution),
  };
}

const generateToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      uuid: user.uuid,
      role: user.role,
    },
    process.env.ACCESS_SECRET,
    { expiresIn: "30d" },
  );

module.exports = {
  serializeBigInt,
  serializeBook,
  getValidStream,
  serializeVideos,
  generateToken,
};
