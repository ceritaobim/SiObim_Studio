const token = process.env.BUFFER_ACCESS_TOKEN;

async function check() {
  const query = `
    query {
      posts(input: {
        organizationId: "6ae472a4369b5e72588426b6",
        filter: { status: scheduled }
      }) {
        totalCount
        edges {
          node {
            id
            channelId
            status
            dueAt
            text
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  console.log("Scheduled posts result:", JSON.stringify(data, null, 2));
}

check();
