const prisma = require("../lib/prisma");

const createComment = async (req, res) => {
  try {
    const userId = req.user.id; // dari auth middleware
    const { bookId, content } = req.body;

    if (!bookId || !content?.trim()) {
      return res.status(400).json({
        message: "bookId and content are required",
      });
    }

    // cek book ada atau tidak
    const book = await prisma.book.findUnique({
      where: { bookId },
    });

    if (!book) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId: userId, // ✅ cukup ini
        bookId: book.id,
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

    return res.status(201).json(comment);
  } catch (error) {
    console.error("Create comment error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getComments = async (req, res) => {
  try {
    const { bookId, cursor, limit = 10 } = req.query;

    if (!bookId) {
      return res.status(400).json({
        message: "bookId is required",
      });
    }

    const comments = await prisma.comment.findMany({
      where: {
        bookId: Number(bookId),
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

    const formatted = comments.map((comment) => ({
      ...comment,
      createdAt: formatRelativeTime(comment.createdAt),
    }));

    const nextCursor =
      comments.length === Number(limit)
        ? comments[comments.length - 1].id
        : null;
    console.log(formatted);

    return res.json({
      data: formatted,
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

module.exports = { createComment, deleteComment, getComments };
