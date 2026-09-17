export default {
	async fetch(request, env, ctx) {
		return new Response(
			JSON.stringify({
				message: "Worker is alive!"
			}),
			{
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			}
		);
	},
};