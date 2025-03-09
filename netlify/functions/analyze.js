const { createClient } = require('@netlify/functions');
const fetch = require('node-fetch');
const FormData = require('form-data');
const multipart = require('parse-multipart-data');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const SpotifyWebApi = require('spotify-web-api-node');

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize the Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Function to get Spotify access token
async function getSpotifyAccessToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    return data.body['access_token'];
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    throw error;
  }
}

// Function to analyze image using Gemini Vision
async function analyzeImage(imageData) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
    
    // Convert image data to base64
    const base64Image = Buffer.from(imageData).toString('base64');
    
    // Create prompt parts
    const promptParts = [
      { text: "Analyze this image and provide a detailed description. Identify the scene type, mood, emotion, and dominant colors. Also, suggest music keywords that would match this image's vibe." },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      }
    ];
    
    const result = await model.generateContent({ contents: [{ role: "user", parts: promptParts }] });
    const response = await result.response;
    const text = response.text();
    
    // Parse the response to extract information
    const sceneMatch = text.match(/Scene(?:\s+type)?[:\s]+([^\n.]+)/i);
    const moodMatch = text.match(/Mood[:\s]+([^\n.]+)/i);
    const emotionMatch = text.match(/Emotion[:\s]+([^\n.]+)/i);
    const colorMatch = text.match(/(?:Dominant )?Colors?[:\s]+([^\n.]+)/i);
    
    // Extract music keywords
    const musicKeywordsMatch = text.match(/Music keywords[:\s]+([^\n.]+(?:\n[^\n.]+)*)/i);
    let musicKeywords = [];
    if (musicKeywordsMatch && musicKeywordsMatch[1]) {
      musicKeywords = musicKeywordsMatch[1]
        .split(/,|\n/)
        .map(keyword => keyword.trim())
        .filter(keyword => keyword && !keyword.includes(':'));
    }
    
    // Generate Instagram caption
    const captionPrompt = [
      { text: "Based on this image, create a catchy and engaging Instagram caption that would get a lot of likes and engagement. Make it trendy and appealing to a young audience. Keep it under 150 characters." },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      }
    ];
    
    const captionResult = await model.generateContent({ contents: [{ role: "user", parts: captionPrompt }] });
    const captionResponse = await captionResult.response;
    const instagramCaption = captionResponse.text().replace(/["']/g, '').trim();
    
    return {
      imageDescription: text.split('\n\n')[0],
      scene: sceneMatch ? sceneMatch[1].trim() : "Unknown",
      mood: moodMatch ? moodMatch[1].trim() : "Unknown",
      emotion: emotionMatch ? emotionMatch[1].trim() : "Unknown",
      dominantColor: colorMatch ? colorMatch[1].trim() : "Unknown",
      imageKeywords: musicKeywords,
      primaryKeyword: musicKeywords.length > 0 ? musicKeywords[0] : "",
      instagramCaption: instagramCaption
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
}

// Function to search Spotify tracks based on keywords
async function searchSpotifyTracks(keywords, limit = 10) {
  try {
    await getSpotifyAccessToken();
    
    const allTracks = [];
    const seenTrackIds = new Set();
    
    // Search for each keyword individually
    for (const keyword of keywords) {
      const results = await spotifyApi.searchTracks(keyword, { limit: Math.ceil(limit / keywords.length) });
      
      if (results.body.tracks && results.body.tracks.items) {
        for (const track of results.body.tracks.items) {
          // Skip if we've already seen this track
          if (seenTrackIds.has(track.id)) continue;
          seenTrackIds.add(track.id);
          
          // Calculate relevance score (higher for primary keyword)
          const relevance = keyword === keywords[0] ? 85 : 65;
          
          allTracks.push({
            id: track.id,
            name: track.name,
            artist: track.artists.map(artist => artist.name).join(', '),
            album: track.album.name,
            album_art: track.album.images.length > 0 ? track.album.images[0].url : null,
            preview_url: track.preview_url,
            spotify_url: track.external_urls.spotify,
            relevance: relevance,
            match_type: keyword === keywords[0] ? 'Primary Match' : 'Related Match'
          });
          
          if (allTracks.length >= limit) break;
        }
      }
      
      if (allTracks.length >= limit) break;
    }
    
    // If we don't have enough tracks, search for combined keywords
    if (allTracks.length < limit && keywords.length > 1) {
      const combinedKeyword = keywords.slice(0, 2).join(' ');
      const results = await spotifyApi.searchTracks(combinedKeyword, { limit: limit - allTracks.length });
      
      if (results.body.tracks && results.body.tracks.items) {
        for (const track of results.body.tracks.items) {
          // Skip if we've already seen this track
          if (seenTrackIds.has(track.id)) continue;
          seenTrackIds.add(track.id);
          
          allTracks.push({
            id: track.id,
            name: track.name,
            artist: track.artists.map(artist => artist.name).join(', '),
            album: track.album.name,
            album_art: track.album.images.length > 0 ? track.album.images[0].url : null,
            preview_url: track.preview_url,
            spotify_url: track.external_urls.spotify,
            relevance: 75,
            match_type: 'Combined Match'
          });
          
          if (allTracks.length >= limit) break;
        }
      }
    }
    
    return allTracks;
  } catch (error) {
    console.error('Error searching Spotify tracks:', error);
    throw error;
  }
}

exports.handler = async (event, context) => {
  try {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

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

    // Analyze the image using Gemini Vision
    const analysisResults = await analyzeImage(imagePart.data);
    
    // Search for Spotify tracks based on the keywords
    const spotifyTracks = await searchSpotifyTracks(
      analysisResults.imageKeywords.slice(0, 3), // Use top 3 keywords
      10 // Limit to 10 tracks
    );
    
    // Return the combined results
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...analysisResults,
        spotifyTracks
      }),
    };
  } catch (error) {
    console.error('Error in serverless function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
    };
  }
};
