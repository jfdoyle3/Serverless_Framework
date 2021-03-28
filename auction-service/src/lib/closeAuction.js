import AWS from 'aws-sdk';

const dynamodb=new AWS.DynamoDB.DocumentClient();
const sqs=new AWS.SQS();

export async function closeAuction(auction){
    const params = {
        TableName: process.env.AUCTIONS_TABLE_NAME,
        Key: {id: auction.id},
        UpdateExpression: 'set #status=:status',
        ExpressionAttributeValues: {
            ':status': 'CLOSED',
        },
        ExpressionAttributeNames: {
            '#status': 'status',
        },
    };

   await dynamodb.update(params).promise();
   
   const {title, seller, highestBid } = auction;
   const {amount, bidder } = highestBid;

   if (amount === 0){
       await sqs.sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
            subject: 'Your item did not sell!',
            recipient: seller,
            body: `Oh No! Your item: "${title}" didn not get any bids.`,
       }),
    }).promise();
       return;
   }

   const notifySeller=sqs.sendMessage({
       QueueUrl: process.env.MAIL_QUEUE_URL,
       MessageBody: JSON.stringify({
           subject: 'Your item has been sold!',
           recipient: seller,
           body: `Congratulations! Your item: "${title}" has been sold for $${amount}.`,
       }),
   }).promise();

   const notifyBidder=sqs.sendMessage({
    QueueUrl: process.env.MAIL_QUEUE_URL,
    MessageBody: JSON.stringify({
        subject: 'You won an auction!',
        recipient: bidder,
        body: `What a great deal! You won: "${title}" for $${amount}.`,
      }),
    }).promise();

    return Promise.all([notifySeller, notifyBidder]);
}