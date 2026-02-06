const api = require("../lib/api");
const { isExpired } = require("../lib/ceck");
const prisma = require("../lib/prisma");

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

const getLatest = async (req, res, next) => {
  try {
    const dataDb = await prisma.book.findMany({
      where: {
        isHot: { not: false },
      },
      include: {
        series: { include: { videos: true } },
        tags: { include: { tag: true } },
      },
    });

    if (dataDb.length > 0) {
      const serialized = await Promise.all(
        dataDb.map(async (book) => {
          if (book.series && book.series.videos) {
            // regen expired videos hanya jika perlu
            const videos = await Promise.all(
              book.series.videos.map(async (video) => {
                // cek apakah expired
                if (!isExpired(video.expireTime)) {
                  // belum expired → pakai video lama
                  return {
                    ...video,
                    expireTime: Number(video.expireTime || 0),
                  };
                }

                // expired → fetch stream baru
                const updatedVideo = await getValidStream(video.videoId, video);

                // update DB hanya saat expired
                await prisma.video.update({
                  where: { id: video.id },
                  data: {
                    mainUrl: updatedVideo.mainUrl,
                    backupUrl: updatedVideo.backupUrl,
                    expireTime: updatedVideo.expireTime,
                  },
                });

                console.log(`updated videoId: ${video.videoId}`);

                return {
                  ...video,
                  ...updatedVideo,
                };
              }),
            );

            // assign hasil update ke series.videos
            book.series.videos = videos;
          }

          // serialize expireTime jika masih BigInt
          if (book.series && book.series.videos) {
            book.series.videos = book.series.videos.map((v) => ({
              ...v,
              expireTime: Number(v.expireTime || 0),
            }));
          }

          return book;
        }),
      );

      res.status(200).json(serialized);
      console.log("ambil langsung dan update expireTime jika perlu");
      return;
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
            tags: { include: { tag: true } },
          },
        });

        if (dbBook) {
          if (dbBook.series && dbBook.series.videos) {
            dbBook.series.videos = dbBook.series.videos.map((v) => ({
              ...v,
              expireTime: Number(v.expireTime || 0),
            }));
          }
          console.log("abil dari db");

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
          console.log("abil dari luar");

          return dbBook;
        }
      }),
    );

    res.status(200).json(data);
  } catch (error) {
    console.log(error);
  }
};

const trending = async (req, res, next) => {
  try {
    const melolo = await api.get("/trending");

    let isDetailFetch = false;
    const data = await Promise.all(
      melolo.data.books.map(async (book) => {
        // cek db
        let dbBook = await prisma.book.findUnique({
          where: { bookId: book.book_id },
          include: {
            series: { include: { videos: true } },
            tags: { include: { tag: true } },
          },
        });

        if (dbBook) {
          if (dbBook.series && dbBook.series.videos) {
            dbBook.series.videos = await Promise.all(
              dbBook.series.videos.map(async (v) => {
                const expired = isExpired(Number(v.expireTime));

                // 1️⃣ belum expired → langsung pakai
                if (!expired) {
                  return {
                    ...v,
                    expireTime: Number(v.expireTime || 0),
                  };
                }

                // 2️⃣ expired → fetch stream baru
                const stream = await getValidStream(v.videoId, v);

                // 3️⃣ update DB hanya jika expired
                await prisma.video.update({
                  where: { id: v.id },
                  data: {
                    mainUrl: stream.mainUrl,
                    backupUrl: stream.backupUrl,
                    expireTime: stream.expireTime,
                    videoHeight: stream.videoHeight,
                    videoWidth: stream.videoWidth,
                  },
                });

                return {
                  ...v,
                  ...stream,
                };
              }),
            );
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
};

const search = async (req, res, next) => {
  try {
    const { q, limit = 10, offset = 0 } = req.query;

    // 1️⃣ cek di database dulu
    const dbBooks = await prisma.book.findMany({
      where: {
        bookName: {
          contains: q, // case-insensitive tergantung collation DB
        },
      },
      include: {
        series: { include: { videos: true } },
        tags: { include: { tag: true } },
      },
      take: Number(limit),
      skip: Number(offset),
    });

    if (dbBooks.length > 0) {
      // serialize BigInt expireTime
      const serialized = dbBooks.map((book) => {
        if (book.series && book.series.videos) {
          book.series.videos = book.series.videos.map((v) => ({
            ...v,
            expireTime: Number(v.expireTime || 0),
          }));
        }
        return book;
      });

      console.log("ambil dari database langsung");
      return res.json(serialized);
    }

    const melolo = await api.get(
      `/search?query=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`,
    );

    const data = melolo.data.data.search_data;

    // filter buku yang punya abstract & book_name
    const filteredGroups = data
      .map((group) => ({
        ...group,
        books: group.books.filter((book) => book.abstract && book.book_name),
      }))
      .filter((group) => group.books.length > 0);

    const result = [];

    for (const group of filteredGroups) {
      const booksData = [];

      for (const book of group.books) {
        // cek DB
        let dbBook = await prisma.book.findUnique({
          where: { bookId: book.book_id },
          include: {
            series: { include: { videos: true } },
            tags: { include: { tag: true } },
          },
        });

        if (dbBook) {
          // serialize expireTime
          if (dbBook.series && dbBook.series.videos) {
            dbBook.series.videos = dbBook.series.videos.map((v) => ({
              ...v,
              expireTime: Number(v.expireTime || 0),
            }));
          }
          booksData.push(dbBook);
          continue;
        }

        // ambil detail dari API
        const detail = await api.get(`/detail/${book.book_id}`);
        const detailData = detail.data.data;
        if (!detailData) continue;

        const video_data = detailData?.video_data || {};
        const videos = [];

        for (const vid of video_data.video_list || []) {
          // cek DB video dulu, jika ada bisa dipakai
          const oldVideo = null; // nanti bisa prisma.video.findUnique
          const stream = await getValidStream(vid.vid, oldVideo);

          videos.push({
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
          });
        }

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
        dbBook = await prisma.book.upsert({
          where: { bookId: book.book_id },
          update: {}, // tidak ada update, cuma ambil data jika sudah ada
          create: {
            bookId: book.book_id,
            bookName: book.book_name,
            description: book.abstract,
            subDescription: book.sub_abstract,
            isHot: book.is_hot === "1",
            language: book.language,
            totalChapter: Number(book.last_chapter_index),
            thumbUrl: book.thumb_url,
            series: { create: series },
            tags: { create: tags },
          },
          include: {
            series: { include: { videos: true } },
            tags: { include: { tag: true } },
          },
        });

        // simpan buku ke DB
        // dbBook = await prisma.book.create({
        //   data: {
        //     bookId: book.book_id,
        //     bookName: book.book_name,
        //     description: book.abstract,
        //     subDescription: book.sub_abstract,
        //     isHot: book.is_hot === "1",
        //     language: book.language,
        //     totalChapter: Number(book.last_chapter_index),
        //     thumbUrl: book.thumb_url,
        //     series: { create: series },
        //     tags: { create: tags },
        //   },
        //   include: {
        //     series: { include: { videos: true } },
        //     tags: { include: { tag: true } },
        //   },
        // });

        // serialize expireTime BigInt → Number
        if (dbBook.series && dbBook.series.videos) {
          dbBook.series.videos = dbBook.series.videos.map((v) => ({
            ...v,
            expireTime: Number(v.expireTime || 0),
          }));
        }

        booksData.push(dbBook);
      }

      result.push({
        // ...group,
        books: booksData,
      });
    }
    console.log(result);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

const play = async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await prisma.video.findUnique({
      where: { videoId },
    });

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    const expired = isExpired(Number(video.expireTime));

    // masih valid
    if (!expired) {
      return res.json({
        streamUrl: video.mainUrl,
        expireTime: Number(video.expireTime),
      });
    }

    // expired → refresh
    const stream = await getValidStream(videoId, video);

    await prisma.video.update({
      where: { id: video.id },
      data: {
        mainUrl: stream.mainUrl,
        backupUrl: stream.backupUrl,
        expireTime: stream.expireTime,
        videoWidth: stream.videoWidth,
        videoHeight: stream.videoHeight,
      },
    });

    return res.json({
      streamUrl: stream.mainUrl,
      expireTime: stream.expireTime,
      refreshed: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get stream" });
  }
};

module.exports = { getLatest, trending, search, play };
