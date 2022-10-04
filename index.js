const general_transformations = require('./transformations/general')
const cloudflare_transformations = require('./transformations/cloudflare')
const utils = require('./utils')

module.exports = {
	...cloudflare_transformations,
	...general_transformations,
	...utils
}
