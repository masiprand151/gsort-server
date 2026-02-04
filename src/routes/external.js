const api = require("../lib/api");
const { isExpired } = require("../lib/ceck");
const prisma = require("../lib/prisma");

const route = require("express").Router();

route.get("/api/latest", async (req, res, next) => {
  try {
    async function getValidStream(vid, oldVideo) {
      if (oldVideo && !isExpired(oldVideo.expire_time)) {
        return oldVideo;
      }

      // expired → regenerate
      const stream = await api.get(`/stream/${vid}`);
      const model = stream.data.data;

      return {
        mainUrl: model.main_url,
        backupUrl: model.backup_url,
        expireTime: Number(model.expire_time),
        videoHeight: model.video_height,
        videoWidth: model.video_width,
      };
    }

    const melolo = await api.get("/latest");
    let isDetailFetch = false;
    const data = await Promise.all(
      melolo.data.books.map(async (book) => {
        // cek db
        let dbBook = await prisma.book.findUnique({
          where: { bookId: book.book_id },
          include: {
            series: { include: { videos: true } },
            tags: true,
          },
        });

        if (dbBook) {
          if (dbBook.series && dbBook.series.videos) {
            dbBook.series.videos = dbBook.series.videos.map((v) => ({
              ...v,
              expireTime: Number(v.expireTime || 0),
            }));
          }
          return dbBook;
        }

        let detailData;
        if (!isDetailFetch) {
          const detail = await api.get(`/detail/${book.book_id}`);
          detailData = detail.data.data;
          isDetailFetch = true;
        }
        if (detailData) {
          const video_data = detailData?.video_data;

          const videos = await Promise.all(
            video_data.video_list.map(async (vid) => {
              // contoh: ambil dari DB dulu
              const oldVideo = null; // nanti: prisma.video.findUnique

              const stream = await getValidStream(vid.vid, oldVideo);

              return {
                videoId: vid.vid,
                index: vid.vid_index,
                title: vid.title,
                duration: vid.duration,
                mainUrl: stream.mainUrl,
                backupUrl: stream.backupUrl,
                expireTime: stream.expireTime,
                cover: vid.cover,
                episodeCover: vid.episode_cover,
                videoHeight: stream.videoHeight,
                videoWidth: stream.videoWidth,
              };
            }),
          );

          const tags = (book.stat_infos || []).map((t) => ({
            tag: {
              connectOrCreate: {
                where: { name: t },
                create: { name: t },
              },
            },
          }));

          const series = {
            seriesId: String(video_data.series_id),
            title: video_data.series_title,
            intro: video_data.series_intro,
            cover: video_data.series_cover,
            episodeCount: video_data.episode_cnt,
            followed: video_data.followed,
            followedCount: video_data.followed_cnt,
            videos: { create: videos },
          };

          // simpan ke db
          dbBook = await prisma.book.create({
            data: {
              bookId: book.book_id,
              bookName: book.book_name,
              description: book.abstract,
              subDescription: book.sub_abstract,
              isHot: book.is_hot === "1",
              language: book.language,
              totalChapter: Number(book.last_chapter_index),
              thumbUrl: book.thumb_url,
              series: {
                create: series,
              },

              tags: { create: tags },
            },
            include: {
              series: { include: { videos: true } },
              tags: { include: { tag: true } },
            },
          });
          if (dbBook.series && dbBook.series.videos) {
            dbBook.series.videos = dbBook.series.videos.map((v) => ({
              ...v,
              expireTime: Number(v.expireTime || 0),
            }));
          }

          return dbBook;
        }
      }),
    );

    res.status(200).json(data);
  } catch (error) {
    console.log(error);
  }
});

module.exports = route;
