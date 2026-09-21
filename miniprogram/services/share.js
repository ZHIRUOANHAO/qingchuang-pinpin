function pageMessage(title, path, imageUrl) {
  return { title, path, imageUrl }
}

function timelineMessage(title, query = '') {
  return { title, query }
}

module.exports = { pageMessage, timelineMessage }
