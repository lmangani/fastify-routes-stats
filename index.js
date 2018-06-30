'use strict'

const fp = require('fastify-plugin')
const { performance } = require('perf_hooks')
const summary = require('summary')

const ONSEND = 'on-send-'
const PREHANDLER = 'pre-handler-'
const ROUTES = 'fastify-routes:'

module.exports = fp(async function (fastify, opts) {
  fastify.addHook('preHandler', function (request, reply, next) {
    const id = request.raw.id
    performance.mark(PREHANDLER + id)
    next()
  })

  fastify.addHook('onSend', function (request, reply, _, next) {
    let routeId = request.raw.url
    if (reply.context.config.statsId) {
      routeId = reply.context.config.statsId
    }
    const id = request.raw.id
    performance.mark(ONSEND + id)
    performance.measure(ROUTES + routeId, PREHANDLER + id, ONSEND + id)

    performance.clearMarks(ONSEND + id)
    performance.clearMarks(PREHANDLER + id)

    next()
  })

  fastify.decorate('measurements', measurements)
  if (opts.prometheus) { fastify.decorate('stats', promStats) } else { fastify.decorate('stats', stats) }

  const interval = setInterval(() => fastify.log.info({ stats: stats() }, 'routes stats'), 30000)
  interval.unref()

  fastify.onClose(function () {
    clearInterval(interval)
  })
})

function measurements () {
  return performance.getEntriesByType('measure').filter(e => {
    return e.name.indexOf(ROUTES) === 0
  }).reduce((acc, e) => {
    const key = e.name.split(':')[1]
    if (acc[key]) {
      acc[key].push(e.duration)
    } else {
      acc[key] = [e.duration]
    }
    return acc
  }, {})
}

function stats () {
  const m = measurements()

  return Object.keys(m).reduce((acc, k) => {
    const s = summary(m[k])
    acc[k] = {
      mean: s.mean(),
      mode: s.mode(),
      median: s.median(),
      max: s.max(),
      min: s.min(),
      sd: s.sd()
    }

    // always clear our measures after stats()
    performance.clearMeasures(ROUTES + k)

    return acc
  }, {})
}

function promStats () {
  const m = measurements()
  var metrics = ''
  return Object.keys(m).reduce((acc, k) => {
    const s = summary(m[k])
    var e = 'fastify_' + k.split('/').join('_')
    metrics += '# HELP ' + e + ' The total number of HTTP requests.\r\n'
    metrics += e + '_mean ' + s.mean() + '\r\n'
    metrics += e + '_max ' + s.max() + '\r\n'
    metrics += e + '_min ' + s.min() + '\r\n'
    metrics += e + '_median ' + s.median() + '\r\n'
    metrics += e + '_sd ' + s.sd() + '\r\n'
    metrics += e + '_mode ' + s.mode() + '\r\n'

    // always clear our measures after stats()
    performance.clearMeasures(ROUTES + k)

    return metrics
  }, '')
}
