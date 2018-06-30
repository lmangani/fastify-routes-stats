'use strict'

const Fastify = require('fastify')
const fastify = Fastify({
  logger: true
})

fastify.register(require('.'), {prometheus: true})

fastify.get('/', function (request, reply) {
  reply.send({ hello: 'world' })
})

fastify.get('/:param/dynamic-route-example', { config: { statsId: 'group-stats-together' } }, function (request, reply) {
  reply.send({ hello: 'world' })
})

fastify.get('/metrics', function (request, reply) {
  reply.send(this.stats())
})

fastify.listen(3000)
