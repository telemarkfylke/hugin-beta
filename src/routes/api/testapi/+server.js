
/** @type {import("./$types").RequestHandler} */
export const GET = async ({ request }) => {
  console.log('Received request')
  return new Response(JSON.stringify({ message: 'Data received successfully' }), { status: 200 });
}