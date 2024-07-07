import { createClient } from "@/utils/supabase/server";
import OpenAI from "openai";
import { getIntegrationKey, getIntegrationRefreshKey } from "@/utils/crudactions";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  baseURL: 'https://api.perplexity.ai/',
});


export async function categorizeNextMove(aiState: any) {
  "use server";
  // Convert all messages into LLM parsable string
  const classifierMessages = aiState.get().messages.map((message:any) => ({
    role: message.role,
    content: message.content,
    name: message.name,
  }));

  // Add your categorization prompt as a system message
  classifierMessages.push({
    role: "system",
    content:
      'You are an intelligent assistant bot that helps with different tools and functions automatically as the user prompts. parse ONLY the most recent user message. Find the intent of what the user wants to do and return back with a single word response ONLY. There are a multitude of choices you can take based on what the user wants. If the user wants something to do with stocks, reply "STOCKS". If the user wants something to do with weather, reply "WEATHER". If the user wants to get their top music tracks or something to do with spotify, reply "SPOTIFY". If the user wants to know whats happening in camera or wants you to look at the camera or understand visual or spatial environment around them, or If the user wants to know whats happening in their screen or wants you to look at the screen or understand visual content in their current device screen, reply "CAMERA". If the user wants to generate any kind of static image or artwork, reply "DALLE". If the user wants to generate any kind of moving video, reply "PIKA". If the user wants you to display something relating to 3d models or 3d, reply "3D".If the user wants you to answer something that is beyond your knowledge cutoff date, or something that should have a realtime piece of searchable information that is also not under any category mentioned here, reply "REALTIME". If the user wants to do something that is not mentioned here, reply "OTHERS"',
  });

  try {
    const completion = await openai.chat.completions.create({
      messages: classifierMessages,
      model: "gpt-4-turbo",
    });

    return completion;
  } catch (error) {
    console.error("Failed to get a successful response from OpenAI:", error);
    throw error; // Rethrow or handle the error appropriately
  }
}


export async function generateImagePrompt(aiState: any) {
  "use server";
  // Convert all messages into LLM parsable string
  const threadMessages = aiState.get().messages.map((message: any) => ({
    role: message.role,
    content: message.content,
    name: message.name,
  }));

  // Add your image generation prompt as a system message
  threadMessages.push({
    role: "system",
    content:
      'You are an intelligent assistant bot that helps with generating image prompts. Based on the entire conversation thread, especially the recent messages, create a concise and detailed prompt for generating an image. The prompt should be clear and specific to ensure the best and highest quality possible image generation. return back purely the prompt content ONLY.',
  });

  try {
    const completion = await openai.chat.completions.create({
      messages: threadMessages,
      model: "gpt-4-turbo",
    });

    // Extract and return the prompt from the completion
    const prompt = completion.choices[0].message.content;
    return prompt;
  } catch (error) {
    console.error("Failed to get a successful response from OpenAI:", error);
    throw error; // Rethrow or handle the error appropriately
  }
}

export async function generateVideoPrompt(aiState: any) {
  "use server";
  // Convert all messages into LLM parsable string
  const threadMessages = aiState.get().messages.map((message: any) => ({
    role: message.role,
    content: message.content,
    name: message.name,
  }));

  // Add your video generation prompt as a system message
  threadMessages.push({
    role: "system",
    content:
      'You are an intelligent assistant bot that helps with generating video prompts. Based on the entire conversation thread, especially the recent messages, create a concise and detailed prompt for generating a video. The prompt should be clear and specific to ensure the best and highest quality possible video generation. return back purely the prompt content ONLY.',
  });

  try {
    const completion = await openai.chat.completions.create({
      messages: threadMessages,
      model: "gpt-4-turbo",
    });

    // Extract and return the prompt from the completion
    const prompt = completion.choices[0].message.content;
    return prompt;
  } catch (error) {
    console.error("Failed to get a successful response from OpenAI:", error);
    throw error; // Rethrow or handle the error appropriately
  }
}



export async function talkToPPLX(aiState: any) {
  "use server";
  // Convert recent messages into LLM parsable string
  const recentMessages = aiState.get().messages.slice(-5).map((message: any) => ({
    role: message.role,
    content: message.content,
    name: message.name,
  }));

  // Add a system message to instruct GPT-4 to create a prompt for Perplexity
  recentMessages.push({
    role: "system",
    content:
      'You are an intelligent assistant bot. Based on the recent messages, create a concise and detailed prompt that can be used to get an accurate answer from a google search. The prompt should be clear and specific to ensure the best possible response.',
  });

  try {
    // Use GPT-4 to create a prompt for Perplexity
    const gptCompletion = await openai.chat.completions.create({
      messages: recentMessages,
      model: "gpt-4-turbo",
    });

    const generatedPrompt = gptCompletion.choices[0].message.content;
    console.log("the generated prompt for realtime scraping is ", generatedPrompt);

    if (!generatedPrompt) {
      throw new Error("Generated prompt is null or undefined");
    }

    const completion = await perplexity.chat.completions.create({
      messages: [{ role: "user", content: generatedPrompt }],
      model: "sonar-medium-online",
    });

    return completion;
  } catch (error) {
    console.error("Failed to get a successful response:", error);
    throw error; // Rethrow or handle the error appropriately
  }
}


export async function talkToSpotify() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  console.log(user?.id.toString());

  const spotifyAccessKey = await getIntegrationKey(user?.id.toString() || '', "spotify");
  const spotifyRefreshKey = await getIntegrationRefreshKey(user?.id.toString() || '', "spotify");


  if (spotifyAccessKey) {
    const TOP_TRACKS_ENDPOINT = `https://api.spotify.com/v1/me/top/tracks`;

    const response = await fetch(TOP_TRACKS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${spotifyAccessKey}`,
      },
    });

    const data = await response.json();

    if (data.error && data.error.status === 401 && data.error.message === 'The access token expired') {
      // await refreshSpotifyToken(user?.id.toString() || '', spotifyRefreshKey || '');
      // return await talkToSpotify();
      return [];
  }

    const songs = data.items.slice(0, 3).map((item:any) => ({
      name: item.name,
      album: item.album.images[0].url, // Assuming album art is in the first image
      artist: item.artists.map((artist:any) => artist.name).join(", "),
      link: item.external_urls.spotify,
    }));

    return songs;
  } else {
    console.log("Error: Spotify integration key not found.");
    return [];
  }
}

export async function generateVideo(
  prompt: string,
  sfx: boolean = true,
  aspectRatio: string = "5:2",
  frameRate: number = 20,
  camera: { pan: string; tilt: string; rotate: string; zoom: string } = { pan: "right", tilt: "up", rotate: "cw", zoom: "in" },
  guidanceScale: number = 16,
  motion: number = 2,
  negativePrompt: string = "ugly",
  seed: number = 144124,
  extend: boolean = false
): Promise<{ resultUrl: string; imageThumb: string }> {
  const requestBody = {
    promptText: prompt,
    sfx,
    options: {
      aspectRatio,
      frameRate,
      camera,
      parameters: {
        guidanceScale,
        motion,
        negativePrompt,
        seed,
      },
      extend,
    },
  };

  console.log("Sending request to generate video with prompt:", prompt);

  const response = await fetch("https://api.pikapikapika.io/web/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.PIKA_VIDEO_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    console.error("Failed to generate video:", response.statusText);
    throw new Error(`Error: ${response.statusText}`);
  }

  const data = await response.json();
  const jobId = data.job.id;

  console.log("Video generation job started with job ID:", jobId);

  // Polling function to check job status
  async function checkJobStatus(jobId: string): Promise<{ resultUrl: string; imageThumb: string }> {
    console.log("Checking job status for job ID:", jobId);

    const jobResponse = await fetch(`https://api.pikapikapika.io/web/jobs/${jobId}`, {
      headers: {
        "Authorization": `Bearer ${process.env.PIKA_VIDEO_API_KEY}`,
      },
    });

    if (!jobResponse.ok) {
      console.error("Failed to check job status:", jobResponse.statusText);
      throw new Error(`Error: ${jobResponse.statusText}`);
    }

    const jobData = await jobResponse.json();
    console.log("Job status:", jobData.job.status);

    if (jobData.job.status === "finished") {
      const video = jobData.videos[0];
      console.log("Video generation completed. Result URL:", video.resultUrl);
      return { resultUrl: video.resultUrl, imageThumb: video.imageThumb };
    } else {
      // Wait for a while before checking again
      await new Promise(resolve => setTimeout(resolve, 13000));
      return checkJobStatus(jobId);
    }
  }

  return checkJobStatus(jobId);
}

export async function generateImage(
  prompt: string,
  model: string = "dall-e-3",
  n: number = 1,
  size: string = "1024x1024",
  quality: string = "standard",
  response_format: string = "url",
  style: string = "vivid",
  user: string = ""
): Promise<string> {
  const requestBody = {
    model,
    prompt,
    n,
    size,
    quality,
    response_format,
    style,
    user
  };

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].url;
}




// export async function refreshSpotifyToken(userId: string, refreshToken: string) {
//   console.log("Initiating Spotify token refresh for userID:", userId);

//   const REFRESH_TOKEN_ENDPOINT = 'https://api.spotify.com/v1/token';

//   const requestBody = new URLSearchParams({
//     grant_type: 'refresh_token',
//     refresh_token: refreshToken,
//   });

//   console.log("Sending token refresh request to:", REFRESH_TOKEN_ENDPOINT);
//   console.log("Request Body:", requestBody.toString());

//   const response = await fetch(REFRESH_TOKEN_ENDPOINT, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/x-www-form-urlencoded',
//     },
//     body: requestBody,
//   });

//   console.log("Received response from Spotify token refresh:", response.status, response.statusText);

//   if (response.ok) {
//     const data = await response.json();
//     const newAccessToken = data.access_token;

//     console.log("New access token obtained:", newAccessToken);

//     await setIntegrationKey(userId, 'spotify', newAccessToken, refreshToken);

//     console.log("Successfully updated Spotify integration key for userID:", userId);

//     return newAccessToken;
//   } else {
//     console.error("Failed to refresh Spotify token. Response status:", response.status);
//     throw new Error('Failed to refresh Spotify token');
//   }
// }