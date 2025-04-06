/* eslint-disable */

import { NextFunction, Request, Response } from 'express';
import { CacheStore } from '../data/CacheStore';

type JSONCache = {
  type: 'json';
  body: object;
};

type RenderCache = {
  type: 'render';
  view: string;
  options: object;
};

type SendCache = {
  type: 'send';
  body: string;
};

type Cache = JSONCache | RenderCache | SendCache;

const cache = (cacheStore: CacheStore) => (req: Request, res: Response, next: NextFunction) => {
  const key = req.originalUrl;
  const cached = cacheStore.get(key) as Cache | undefined;

  if (cached) {
    if (cached.type === 'json') {
      return res.json(cached.body);
    }

    if (cached.type === 'send') {
      if (cached.body.startsWith('{') || cached.body.startsWith('[')) {
        return res.json(JSON.parse(cached.body));
      }

      return res.send(cached.body);
    }

    return res.render(cached.view, cached.options);
  }

  // @ts-expect-error
  res.cacheJSONResponse = res.json;

  // @ts-expect-error
  res.json = (body) => {
    cacheStore.set(key, {
      type: 'json',
      body,
    });

    // @ts-expect-error
    res.cacheJSONResponse(body);
  };

  // @ts-expect-error
  res.cacheRenderResponse = res.render;

  // @ts-expect-error
  res.render = (view, options, callback) => {
    cacheStore.set(key, {
      type: 'render',
      view,
      options,
    });

    // @ts-expect-error
    res.cacheRenderResponse(view, options, callback);
  };

  // @ts-expect-error
  res.cacheSendResponse = res.send;

  // @ts-expect-error
  res.send = (body) => {
    cacheStore.set(key, {
      type: 'send',
      body,
    });

    // @ts-expect-error
    res.cacheSendResponse(body);
  };

  return next();
};

export default cache;
