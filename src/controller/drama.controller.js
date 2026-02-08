const api = require("../lib/api");
const { isExpired } = require("../lib/ceck");
const prisma = require("../lib/prisma");
const {
  getValidStream,
  serializeBigInt,
  serializeBook,
  serializeVideos,
} = require("../lib/helper");

const getLatest = async (req, res) => {
  try {
    /**
     * 1️⃣ Ambil dari DB dulu
     */
    const books = await prisma.book.findMany({
      where: { isHot: true },
      include: {
        series: { include: { videos: true } },
        tags: { include: { tag: true } },
      },
    });

    if (books.length > 0) {
      const result = await Promise.all(
        books.map(async (book) => {
          if (!book.series?.videos?.length) return book;

          const updates = [];
          const videos = await Promise.all(
            book.series.videos.map(async (video) => {
              if (!isExpired(video.expireTime)) {
                return video;
              }

              const refreshed = await getValidStream(video.videoId, video);

              updates.push({
                id: video.id,
                data: {
                  mainUrl: refreshed.mainUrl,
                  backupUrl: refreshed.backupUrl,
                  expireTime: refreshed.expireTime,
                  resolution: refreshed.resolution,
                },
              });

              return { ...video, ...refreshed };
            }),
          );

          // 🔥 bulk update (lebih cepat)
          if (updates.length > 0) {
            await prisma.$transaction(
              updates.map((u) =>
                prisma.video.update({
                  where: { id: u.id },
                  data: u.data,
                }),
              ),
            );
          }

          book.series.videos = serializeVideos(videos);
          return book;
        }),
      );

      return res.status(200).json(result);
    }

    /**
     * 2️⃣ Fallback ke API eksternal
     */
    const melolo = await api.get("/latest");

    const result = await Promise.all(
      melolo.data.books.map(async (book) => {
        // cek DB dulu
        const existing = await prisma.book.findUnique({
          where: { bookId: book.book_id },
          include: {
            series: { include: { videos: true } },
            tags: { include: { tag: true } },
          },
        });

        if (existing) {
          if (existing.series?.videos) {
            existing.series.videos = serializeVideos(existing.series.videos);
          }
          return existing;
        }

        // ambil detail
        const detail = await api.get(`/detail/${book.book_id}`);
        const video_data = detail.data?.data?.video_data;
        if (!video_data) return null;

        const videos = await Promise.all(
          video_data.video_list.map(async (vid) => {
            const stream = await getValidStream(vid.vid, null);

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
              resolution: stream.resolution,
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

        const created = await prisma.book.create({
          data: {
            bookId: book.book_id,
            bookName: book.book_name,
            description: book.abstract,
            subDescription: book.sub_abstract,
            isHot: book.is_hot === "1",
            isExclusive: book.is_exclusive === "1",
            language: book.language,
            totalChapter: Number(book.last_chapter_index),
            thumbUrl: book.thumb_url,
            series: {
              create: {
                seriesId: String(video_data.series_id),
                title: video_data.series_title,
                intro: video_data.series_intro,
                cover: video_data.series_cover,
                episodeCount: video_data.episode_cnt,
                followed: video_data.followed,
                followedCount: video_data.followed_cnt,
                videos: { create: videos },
              },
            },
            tags: { create: tags },
          },
          include: {
            series: { include: { videos: true } },
            tags: { include: { tag: true } },
          },
        });

        created.series.videos = serializeVideos(created.series.videos);

        return created;
      }),
    );

    res.status(200).json(result.filter(Boolean));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const trending = async (req, res) => {
  try {
    const melolo = await api.get("/trending");

    const result = await Promise.all(
      melolo.data.books.map(async (book) => {
        /**
         * 1️⃣ Cek DB dulu
         */
        let dbBook = await prisma.book.findUnique({
          where: { bookId: book.book_id },
          include: {
            series: { include: { videos: true } },
            tags: { include: { tag: true } },
          },
        });

        if (dbBook) {
          if (!dbBook.series?.videos?.length) {
            return dbBook;
          }

          const updates = [];
          const videos = await Promise.all(
            dbBook.series.videos.map(async (v) => {
              if (!isExpired(v.expireTime)) {
                return v;
              }

              const stream = await getValidStream(v.videoId, v);

              updates.push({
                id: v.id,
                data: {
                  mainUrl: stream.mainUrl,
                  backupUrl: stream.backupUrl,
                  expireTime: stream.expireTime,
                  videoHeight: stream.videoHeight,
                  videoWidth: stream.videoWidth,
                  resolution: stream.resolution,
                },
              });

              return { ...v, ...stream };
            }),
          );

          // 🔥 bulk update
          if (updates.length > 0) {
            await prisma.$transaction(
              updates.map((u) =>
                prisma.video.update({
                  where: { id: u.id },
                  data: u.data,
                }),
              ),
            );
          }

          dbBook.series.videos = serializeVideos(videos);
          return dbBook;
        }

        /**
         * 2️⃣ Tidak ada di DB → fetch detail
         */
        const detail = await api.get(`/detail/${book.book_id}`);
        const video_data = detail.data?.data?.video_data;
        if (!video_data) return null;

        const videos = await Promise.all(
          video_data.video_list.map(async (vid) => {
            const stream = await getValidStream(vid.vid, null);

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
              resolution: stream.resolution,
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

        const created = await prisma.book.create({
          data: {
            bookId: book.book_id,
            bookName: book.book_name,
            description: book.abstract,
            subDescription: book.sub_abstract,
            isHot: book.is_hot === "1",
            isExclusive: book.is_exclusive === "1",
            language: book.language,
            totalChapter: Number(book.last_chapter_index),
            thumbUrl: book.thumb_url,
            series: {
              create: {
                seriesId: String(video_data.series_id),
                title: video_data.series_title,
                intro: video_data.series_intro,
                cover: video_data.series_cover,
                episodeCount: video_data.episode_cnt,
                followed: video_data.followed,
                followedCount: video_data.followed_cnt,
                videos: { create: videos },
              },
            },
            tags: { create: tags },
          },
          include: {
            series: { include: { videos: true } },
            tags: { include: { tag: true } },
          },
        });

        created.series.videos = serializeVideos(created.series.videos);

        return created;
      }),
    );

    res.status(200).json(result.filter(Boolean));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const search = async (req, res) => {
  try {
    const { q, limit = 10, offset = 0 } = req.query;
    const take = Number(limit);
    const skip = Number(offset);

    /* ================================
     * 1️⃣ Cari di DB dulu (FAST PATH)
     * ================================ */
    const dbBooks = await prisma.book.findMany({
      where: {
        bookName: {
          contains: q,
        },
      },
      take,
      skip,
      include: {
        series: { include: { videos: true } },
        tags: { include: { tag: true } },
      },
    });

    if (dbBooks.length >= take) {
      // cukup dari DB → stop di sini
      return res.json(dbBooks.map(serializeBook));
    }

    /* ================================
     * 2️⃣ Cari ke API eksternal
     * ================================ */
    const melolo = await api.get(
      `/search?query=${encodeURIComponent(q)}&limit=${take}&offset=${skip}`,
    );

    const apiGroups = melolo.data?.data?.search_data || [];

    // filter group & book valid
    const filteredBooks = apiGroups
      .flatMap((group) => group.books || [])
      .filter((b) => b.abstract && b.book_name);

    if (filteredBooks.length === 0) {
      return res.json(dbBooks.map(serializeBook));
    }

    /* ================================
     * 3️⃣ Batch cek DB (ANTI N+1)
     * ================================ */
    const bookIds = filteredBooks.map((b) => b.book_id);

    const existingBooks = await prisma.book.findMany({
      where: {
        bookId: { in: bookIds },
      },
      include: {
        series: { include: { videos: true } },
        tags: { include: { tag: true } },
      },
    });

    const bookMap = new Map(
      existingBooks.map((b) => [b.bookId, serializeBook(b)]),
    );

    /* ================================
     * 4️⃣ Ambil detail API (PARALLEL)
     * ================================ */
    const missingBooks = filteredBooks.filter((b) => !bookMap.has(b.book_id));

    const details = await Promise.all(
      missingBooks.map(async (book) => {
        try {
          const res = await api.get(`/detail/${book.book_id}`);
          return { book, detail: res.data?.data };
        } catch {
          return null;
        }
      }),
    );

    /* ================================
     * 5️⃣ Simpan ke DB
     * ================================ */
    for (const item of details) {
      if (!item?.detail) continue;

      const { book, detail } = item;
      const videoData = detail.video_data || {};

      /* ===== videos (PARALLEL) ===== */
      const videos = await Promise.all(
        (videoData.video_list || []).map(async (vid) => {
          const stream = await getValidStream(vid.vid, null);
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
            resolution: stream.resolution,
          };
        }),
      );

      /* ===== tags ===== */
      const tags = (book.stat_infos || []).map((t) => ({
        tag: {
          connectOrCreate: {
            where: { name: t },
            create: { name: t },
          },
        },
      }));

      /* ===== series ===== */
      const series = {
        seriesId: String(videoData.series_id),
        title: videoData.series_title,
        intro: videoData.series_intro,
        cover: videoData.series_cover,
        episodeCount: videoData.episode_cnt,
        followed: videoData.followed,
        followedCount: videoData.followed_cnt,
        videos: { create: videos },
      };

      const savedBook = await prisma.book.upsert({
        where: { bookId: book.book_id },
        update: {},
        create: {
          bookId: book.book_id,
          bookName: book.book_name,
          description: book.abstract,
          subDescription: book.sub_abstract,
          isHot: book.is_hot === "1",
          isExclusive: book.is_exclusive === "1",
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

      bookMap.set(book.book_id, serializeBook(savedBook));
    }

    /* ================================
     * 6️⃣ Gabungkan hasil DB + API
     * ================================ */
    const result = [
      ...dbBooks.map(serializeBook),
      ...Array.from(bookMap.values()),
    ].slice(0, take);

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

    //  pakai BigInt langsung
    if (!isExpired(video.expireTime) && video.resolution) {
      return res.json({
        streamUrl: video.mainUrl,
        resolution: video.resolution,
        expireTime: Number(video.expireTime),
      });
    }

    /**
     *  Anti race condition
     * update hanya jika expireTime masih sama
     */
    const stream = await getValidStream(videoId, video);

    await prisma.video.updateMany({
      where: {
        id: video.id,
        expireTime: video.expireTime, // optimistic lock
      },
      data: {
        mainUrl: stream.mainUrl,
        backupUrl: stream.backupUrl,
        expireTime: stream.expireTime,
        videoWidth: stream.videoWidth,
        videoHeight: stream.videoHeight,
        resolution: stream.resolution,
      },
    });

    return res.json({
      streamUrl: stream.mainUrl,
      resolution: stream.resolution,
      expireTime: Number(stream.expireTime),
      refreshed: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get stream" });
  }
};

const getDrama = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const cursor = req.query.cursor
      ? JSON.parse(Buffer.from(req.query.cursor, "base64").toString())
      : null;

    const books = await prisma.book.findMany({
      take: limit + 1,
      ...(cursor && {
        cursor: {
          id: cursor.id,
          createdAt: cursor.createdAt,
          isHot: cursor.isHot,
          isExclusive: cursor.isExclusive,
        },
        skip: 1,
      }),
      orderBy: [
        { isHot: "desc" },
        { isExclusive: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      include: {
        tags: { include: { tag: true } },
        series: true,
      },
    });

    const hasNext = books.length > limit;
    const data = hasNext ? books.slice(0, limit) : books;

    const nextCursor = hasNext
      ? Buffer.from(
          JSON.stringify({
            id: data[data.length - 1].id,
            createdAt: data[data.length - 1].createdAt,
            isHot: data[data.length - 1].isHot,
            isExclusive: data[data.length - 1].isExclusive,
          }),
        ).toString("base64")
      : null;

    console.log(books);

    res.status(200).json({
      data,
      nextCursor,
      hasNext,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed" });
  }
};

const getById = async (req, res) => {
  try {
    const { bookId } = req.params;

    const result = await prisma.book.findUnique({
      where: { bookId },
      include: {
        tags: { include: { tag: true } },
        series: {
          include: {
            videos: true,
          },
        },
      },
    });

    if (!result) {
      return res.status(404).json("Book Not Found");
    }

    res.status(200).json(serializeBigInt(result));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed" });
  }
};

module.exports = { getLatest, trending, search, play, getDrama, getById };
