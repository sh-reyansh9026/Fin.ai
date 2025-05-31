// it is for rate limiting that user can only create 5 transactions in a minute so that server doesn't crash

import arcjet, { tokenBucket } from "@arcjet/next";

const aj = arcjet({
    key: process.env.ARCJET_KEY,
    characterstics: ["userId"], // track based on userId or IP address
    rules: [
        tokenBucket({
            mode: "LIVE",
            refillRate: 10, // 10 transactions
            interval: 3600,
            capacity: 10, // 10 transactions

        })
    ]
});

export default aj;