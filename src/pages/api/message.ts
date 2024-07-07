import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { content } = req.body;
    res.status(200).json({ message: `Received: ${content}` });
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}