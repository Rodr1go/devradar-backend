const axios = require('axios')
const Dev = require('../models/Dev')
const parseStringAsArray = require('../utils/parseStringAsArray')
const { findConnections, sendMessage } = require('../websocket')

module.exports = {
  async index(request, response) {
    const page = parseInt(request.query.page || 1);
    const limit = parseInt(request.query.limit || 4);
    
    try {
      const devs = await Dev.find({}).sort('name').skip(limit * (page - 1)).limit(limit);
      const count = await Dev.find({}).countDocuments();

      return response.status(200).json({devs, count})
    } catch (error) {
      return response.status(500).json({ message: error})
    }
  },

  async store(request, response) {
    const { github_username, techs, latitude, longitude } = request.body
    
    let dev = await Dev.findOne({ github_username })
     
    if (!dev) {
      const apiResponse = await axios.get(`https://api.github.com/users/${github_username}`)
      
      const { name = login, avatar_url, bio } = apiResponse.data
      
      const techsArray = parseStringAsArray(techs) 
      
      const location = {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    
      dev = await Dev.create({
        github_username,
        name,
        avatar_url,
        bio,
        techs: techsArray,
        location
      })

      // Filtrar as conexões que estão há no máximo 10km de distância
      // e que o novo dev tenha pelo menos uma das tecnologias filtradas
      
      const sendSocketMessageTo = findConnections(
        { latitude, longitude },
        techsArray,
      )

      sendMessage(sendSocketMessageTo, 'new-dev', dev)
    }

    return response.json(dev)
  },

  async update(request, response) {
    const _id = request.params.id
    const { github_username, techs, location } = request.body

    const dev = await Dev.findOne({ _id })
    if (!dev) {
      return response.status(400).send('Registro não encontrado!')
    }
    
    const apiResponse = await axios.get(`https://api.github.com/users/${github_username}`)
    const { name = login, avatar_url, bio } = apiResponse.data
    const techsArray = parseStringAsArray(techs) 
    
    const position = {
      type: 'Point',
      coordinates: location.coordinates
    }
    
    const devData = new Dev({
      _id,
      github_username,
      name,
      avatar_url,
      bio,
      techs: techsArray,
      location: position,
    })
    
    await Dev.updateOne(dev, devData)
    
    return response.send(devData)
  },
 
  async destroy(request, response) {
    const id = request.params.id
    const dev = await Dev.findOne({ _id: id })

    if (!dev) {
      return response.status(500).send('Registro não encontrado!')
    }

    Dev.deleteOne(dev, (err) => {
      if (err) {
        return response.send(err)
      }

      return response.status(204).send()
    })
  }
}