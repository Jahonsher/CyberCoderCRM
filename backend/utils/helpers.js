function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getEndOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
}

module.exports = { getTodayRange, getEndOfMonth };
