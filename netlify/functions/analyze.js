const { createClient } = require('@netlify/functions');
const fetch = require('node-fetch');
const FormData = require('form-data');
const multipart = require('parse-multipart-data');

// This is a mock response for static deployment
// In production, you would replace this with your actual backend API URL
const mockAnalysisResponse = {
  scene: "Outdoor Nature",
  mood: "Peaceful",
  emotion: "Relaxed",
  dominantColor: "#4CAF50",
  imageDescription: "A beautiful outdoor scene with natural elements.",
  primaryKeyword: "nature",
  imageKeywords: ["outdoor", "nature", "peaceful", "green", "relaxing"],
  objects: ["trees", "sky", "grass", "mountains"],
  colors: ["green", "blue", "brown"],
  characteristics: ["serene", "natural", "open space"],
  songs: [
    {
      id: "1",
      name: "Natural",
      artist: "Imagine Dragons",
      album: "Origins",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273da6f73a25f4c79d0e6b4a8bd",
      previewUrl: "https://p.scdn.co/mp3-preview/2c0b0e8f0634fd5d709a00cb7d7481bfb63a0a3c",
      spotifyUrl: "https://open.spotify.com/track/2FY7b99s15jUprqC0M5NCT",
      relevance: 95
    },
    {
      id: "2",
      name: "Here Comes The Sun",
      artist: "The Beatles",
      album: "Abbey Road",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273dc30583ba717007b00cceb25",
      previewUrl: "https://p.scdn.co/mp3-preview/6902e7da51d2f17e5369d57dadf8ce7d2a123f99",
      spotifyUrl: "https://open.spotify.com/track/6dGnYIeXmHdcikdzNNDMm2",
      relevance: 90
    },
    {
      id: "3",
      name: "Bloom",
      artist: "The Paper Kites",
      album: "Woodland EP",
      albumArt: "https://i.scdn.co/image/ab67616d0000b2738e8cca3ce2d0e2f4f0e3a9cd",
      previewUrl: "https://p.scdn.co/mp3-preview/f11f48c7f8b9969a99c0eef10eb842e523d77e2a",
      spotifyUrl: "https://open.spotify.com/track/0y7Mc7Jy5y8qI1N6Q9s2rH",
      relevance: 85
    }
  ]
};

exports.handler = async (event, context) => {
  try {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

    // For static deployment, return mock data
    // In a real deployment, you would forward the request to your backend API
    return {
      statusCode: 200,
      body: JSON.stringify(mockAnalysisResponse),
    };

    /* Uncomment this section when you have a real backend API
    // Parse the multipart form data to get the image
    const boundary = multipart.getBoundary(event.headers['content-type']);
    const parts = multipart.parse(Buffer.from(event.body, 'base64'), boundary);
    const imagePart = parts.find(part => part.name === 'image');

    if (!imagePart) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No image provided' }),
      };
    }

    // Create a new form data to forward to the backend
    const formData = new FormData();
    formData.append('image', imagePart.data, {
      filename: imagePart.filename,
      contentType: imagePart.type,
    });

    // Forward the request to the backend API
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`Backend API returned ${response.status}`);
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
    */
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
    };
  }
};
