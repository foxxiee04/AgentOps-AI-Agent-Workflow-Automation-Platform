import { Kafka, logLevel } from "kafkajs";
import { kafkaTopics } from "../src/topics";

function parseBrokers(value: string) {
  return value
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
}

const brokers = parseBrokers(process.env.KAFKA_BROKERS ?? "localhost:9094");
const numPartitions = Number(process.env.KAFKA_TOPIC_PARTITIONS ?? 3);
const replicationFactor = Number(process.env.KAFKA_TOPIC_REPLICATION_FACTOR ?? 1);
const allowIncrease = process.env.KAFKA_TOPIC_ALLOW_INCREASE === "true";
const topicNames = Object.values(kafkaTopics);

const kafka = new Kafka({
  brokers,
  clientId: "agentops-topic-bootstrap",
  connectionTimeout: 2_000,
  logLevel: logLevel.ERROR,
  requestTimeout: 10_000
});

const admin = kafka.admin();

async function main() {
  try {
    await admin.connect();
    const existingTopics = new Set(await admin.listTopics());
    const missingTopics = topicNames.filter((topic) => !existingTopics.has(topic));

    if (missingTopics.length > 0) {
      await admin.createTopics({
        waitForLeaders: true,
        topics: missingTopics.map((topic) => ({
          topic,
          numPartitions,
          replicationFactor
        }))
      });
    }

    if (allowIncrease) {
      const existingTopicList = topicNames.filter((topic) => existingTopics.has(topic));
      if (existingTopicList.length > 0) {
        const metadata = await admin.fetchTopicMetadata({ topics: existingTopicList });
        for (const topicMeta of metadata.topics) {
          const currentPartitions = topicMeta.partitions.length;
          if (currentPartitions < numPartitions) {
            await admin.createPartitions({
              topicPartitions: [
                {
                  topic: topicMeta.name,
                  count: numPartitions
                }
              ]
            });
            console.log(
              JSON.stringify({
                topic: topicMeta.name,
                action: "increase_partitions",
                from: currentPartitions,
                to: numPartitions
              })
            );
          } else if (currentPartitions > numPartitions) {
            // never decrease
          }
        }
      }
    }

    console.log(
      JSON.stringify({
        brokers,
        created: missingTopics,
        totalConfigured: topicNames.length
      })
    );
  } finally {
    await admin.disconnect();
  }
}

void main();
