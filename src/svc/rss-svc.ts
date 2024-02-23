import { Executor } from "../api/executor";

export function getRss(executor: Executor) {
    const feed = executor.getRssAll();
    console.log(feed);
    return feed;
}
