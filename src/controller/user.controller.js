const prisma = require("../lib/prisma");

const profile = async (req, res, next) => {
  try {
    const { q } = req.query;

    const user = await prisma.user.findUnique({
      where: { deviceId: q },
      omit: { password: true },
      include: {
        follows: true,
        books: {
          include: {
            series: {
              include: {
                videos: { include: { likes: true } },
                followers: true,
              },
            },
          },
        },
      },
    });
    if (!user) {
      res.status(404).json({
        message: "user not found",
      });
      return;
    }

    const totalSeriesFollowers = user.books.reduce((acc, book) => {
      return acc + (book.series?.followers?.length || 0);
    }, 0);

    const totalLikes = user.books.reduce((accBook, book) => {
      const seriesLikes = book.series?.videos?.reduce(
        (accVideo, video) => accVideo + (video.likes?.length || 0),
        0,
      );
      return accBook + (seriesLikes || 0);
    }, 0);

    res.status(200).json({
      ...user,
      totalSeriesFollowers,
      totalLikes,
    });
  } catch (error) {
    console.log(error);
  }
};

module.exports = { profile };
