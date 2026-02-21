const { formatRelativeTime } = require("../lib/helper");
const prisma = require("../lib/prisma");

const createComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { videoId, content } = req.body;

    // 1️⃣ Validasi input
    if (!videoId || !content?.trim()) {
      return res.status(400).json({
        message: "videoId and content are required",
      });
    }

    // 2️⃣ Cek video ada atau tidak
    const video = await prisma.video.findUnique({
      where: {
        videoId: videoId, // HAPUS Number() kalau di schema String
      },
    });

    if (!video) {
      return res.status(404).json({
        message: "Video not found",
      });
    }

    // 3️⃣ Buat comment
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId,
        videoId: video.videoId, // pastikan sesuai tipe di schema
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // 4️⃣ Return hasil
    return res.status(201).json(comment);
  } catch (error) {
    console.error("Create comment error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

const getComments = async (req, res) => {
  try {
    const { videoId, cursor, limit = 10 } = req.query;

    if (!videoId) {
      return res.status(400).json({
        message: "videoId is required",
      });
    }

    const comments = await prisma.comment.findMany({
      where: {
        videoId: videoId,
      },
      take: Number(limit),
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: Number(cursor) } : undefined,
      orderBy: {
        id: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    const totalCount = await prisma.comment.count({
      where: { videoId: videoId },
    });

    const formatted = comments.map((comment) => ({
      ...comment,
      createdAt: formatRelativeTime(comment.createdAt),
    }));

    const nextCursor =
      comments.length === Number(limit)
        ? comments[comments.length - 1].id
        : null;

    return res.json({
      data: comments,
      totalCount,
      nextCursor,
      hasNext: !!nextCursor,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id: Number(id) },
    });

    if (!comment) {
      return res.status(404).json({
        message: "Comment not found",
      });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({
        message: "Not allowed",
      });
    }

    await prisma.comment.delete({
      where: { id: Number(id) },
    });

    return res.json({
      message: "Comment deleted",
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const getCommentCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { videoId } = req.params;
    const totalCount = await prisma.comment.count({
      where: { videoId: videoId },
    });

    res.status(200).json({ totalCount });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { createComment, deleteComment, getComments, getCommentCount };
