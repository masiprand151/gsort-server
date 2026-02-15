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
     *  Ambil dari DB dulu
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
                  disclaimer: video.disclaimer,
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
     * Fallback ke API eksternal
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
              disclaimer: JSON.stringify(vid.disclaimer_info || "{}"),
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
// trending endpoint
const trending = async (req, res) => {
  try {
    const melolo = await api.get("/trending");
    const result = [];

    for (const book of melolo.data.books) {
      try {
        const detail = await api.get(`/detail/${book.book_id}`);
        const video_data = detail.data?.data?.video_data;
        if (!video_data) continue;

        const videos = video_data.video_list.map((vid) => {
          const stream = vid.stream || {};
          return {
            videoId: vid.vid,
            index: vid.vid_index,
            title: vid.title,
            duration: vid.duration,
            mainUrl: stream.mainUrl || "",
            backupUrl: stream.backupUrl || null,
            expireTime: stream.expireTime || null,
            cover: vid.cover,
            episodeCover: vid.episode_cover,
            videoHeight: stream.videoHeight || null,
            videoWidth: stream.videoWidth || null,
            resolution: stream.resolution || {},
            disclaimer: JSON.stringify(vid.disclaimer_info || {}),
          };
        });

        const tagsConnect = (book.stat_infos || []).map((t) => ({
          where: { name: t },
          create: { name: t },
        }));

        const bookUpserted = await prisma.book.upsert({
          where: { bookId: book.book_id },
          update: {
            bookName: book.book_name,
            description: book.abstract,
            subDescription: book.sub_abstract,
            isHot: book.is_hot === "1",
            isExclusive: book.is_exclusive === "1",
            language: book.language,
            totalChapter: Number(book.last_chapter_index),
            thumbUrl: book.thumb_url,
            tags: { connectOrCreate: tagsConnect }, // update tags
          },
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
            series: {
              create: {
                seriesId: String(video_data.series_id),
                title: video_data.series_title,
                intro: video_data.series_intro,
                cover: video_data.series_cover,
                episodeCount: video_data.episode_cnt,
                followed: video_data.followed,
                followedCount: video_data.followed_cnt,
                videos: { createMany: { data: videos, skipDuplicates: true } },
              },
            },
            tags: { connectOrCreate: tagsConnect },
          },
          include: {
            series: { include: { videos: true } },
            tags: true,
          },
        });

        if (bookUpserted.series) {
          bookUpserted.series.videos = serializeVideos(
            bookUpserted.series.videos,
          );
        }

        result.push(bookUpserted);
      } catch (err) {
        console.error("Error processing book", book.book_id, err);
        continue;
      }
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("Trending endpoint error:", err.code, err.meta, err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const search = async (req, res) => {
  try {
    const { q, limit = 10, offset = 0 } = req.query;
    if (!q) return res.json([]);

    const take = Number(limit);
    const skip = Number(offset);

    /* ================================
       1️⃣ SEARCH FROM DB
    ================================= */
    const dbBooks = await prisma.book.findMany({
      where: {
        bookName: { contains: q },
      },
      take,
      skip,
      include: {
        series: { include: { videos: true } },
        tags: true, // langsung Tag[]
      },
    });

    const serializedDB = dbBooks.map(serializeBook);

    // kalau sudah cukup → langsung return
    if (serializedDB.length >= take) {
      return res.status(200).json(serializedDB);
    }

    /* ================================
       2️⃣ SEARCH FROM EXTERNAL API
    ================================= */
    const remaining = take - serializedDB.length;
    let apiGroups = [];

    try {
      const melolo = await api.get(
        `/search?query=${encodeURIComponent(q)}&limit=${remaining}&offset=${skip}`,
      );
      apiGroups = melolo.data?.data?.search_data || [];
    } catch (err) {
      console.log("External search API error:", err.message);
      return res.status(200).json(serializedDB);
    }

    const filteredBooks = apiGroups
      .flatMap((g) => g.books || [])
      .filter((b) => b.abstract && b.book_name);

    if (!filteredBooks.length) return res.status(200).json(serializedDB);

    /* ================================
       3️⃣ CHECK EXISTING IN DB (BATCH)
    ================================= */
    const bookIds = filteredBooks.map((b) => b.book_id);
    const existingBooks = await prisma.book.findMany({
      where: { bookId: { in: bookIds } },
      include: {
        series: { include: { videos: true } },
        tags: true,
      },
    });

    const bookMap = new Map(
      existingBooks.map((b) => [b.bookId, serializeBook(b)]),
    );

    /* ================================
       4️⃣ FETCH DETAILS FOR MISSING
    ================================= */
    const missingBooks = filteredBooks.filter((b) => !bookMap.has(b.book_id));
    const details = await Promise.all(
      missingBooks.map(async (book) => {
        try {
          const resDetail = await api.get(`/detail/${book.book_id}`);
          return { book, detail: resDetail.data?.data };
        } catch (err) {
          console.log("Detail fetch error:", err.message);
          return null;
        }
      }),
    );

    /* ================================
       5️⃣ SAVE NEW BOOKS (SAFE MODE)
    ================================= */
    for (const item of details) {
      if (!item?.detail) continue;
      try {
        const { book, detail } = item;
        const videoData = detail.video_data || {};

        const videos = await Promise.all(
          (videoData.video_list || []).map(async (vid) => {
            try {
              const stream = await getValidStream(vid.vid, null);
              return {
                videoId: vid.vid,
                index: vid.vid_index,
                title: vid.title,
                duration: vid.duration,
                mainUrl: stream?.mainUrl || null,
                backupUrl: stream?.backupUrl || null,
                expireTime: stream?.expireTime || null,
                cover: vid.cover,
                episodeCover: vid.episode_cover,
                videoHeight: stream?.videoHeight || null,
                videoWidth: stream?.videoWidth || null,
                resolution: stream?.resolution || null,
                disclaimer: JSON.stringify(vid.disclaimer_info || {}),
              };
            } catch (err) {
              console.log("Stream error:", err.message);
              return null;
            }
          }),
        );

        const safeVideos = videos.filter(Boolean);

        // build tags connectOrCreate
        const tagsConnect = (book.stat_infos || []).map((t) => ({
          where: { name: t },
          create: { name: t },
        }));

        const savedBook = await prisma.book.upsert({
          where: { bookId: book.book_id },
          update: {}, // jangan update berat saat search
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
            series: {
              create: {
                seriesId: String(videoData.series_id),
                title: videoData.series_title,
                intro: videoData.series_intro,
                cover: videoData.series_cover,
                episodeCount: videoData.episode_cnt,
                followed: videoData.followed,
                followedCount: videoData.followed_cnt,
                videos: {
                  createMany: { data: safeVideos, skipDuplicates: true },
                },
              },
            },
            tags: { connectOrCreate: tagsConnect }, // schema baru
          },
          include: {
            series: { include: { videos: true } },
            tags: true,
          },
        });

        bookMap.set(book.book_id, serializeBook(savedBook));
      } catch (err) {
        console.log("Save error:", err.message);
      }
    }

    /* ================================
       6️⃣ FINAL MERGE (NO DUPLICATE)
    ================================= */
    const final = [...serializedDB, ...Array.from(bookMap.values())].slice(
      0,
      take,
    );
    return res.status(200).json(final);
  } catch (error) {
    console.error("SEARCH FATAL ERROR:", error);
    return res.status(500).json({
      error: "Something went wrong",
      message: error.message,
    });
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

    return res.status(200).json({
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
    const tagName = req.query.tag;
    const cursor = req.query.cursor
      ? JSON.parse(Buffer.from(req.query.cursor, "base64").toString())
      : null;

    const where = tagName
      ? {
          tags: {
            some: {
              name: {
                contains: tagName,
              },
            },
          },
        }
      : {};

    const books = await prisma.book.findMany({
      take: limit + 1,
      where,
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
        tags: true,
        series: { include: { videos: true } },
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

    res.status(200).json({
      data: serializeBigInt(data),
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

const getAllTags = async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" }, // urut alfabet
      select: {
        id: true,
        name: true,
      },
    });

    res.status(200).json(tags);
  } catch (err) {
    console.error("Error fetching tags:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  getLatest,
  trending,
  search,
  play,
  getDrama,
  getById,
  getAllTags,
};
