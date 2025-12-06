import { Exchange, Operation, OperationResult } from '@urql/core';
import { pipe, map } from 'wonka';

// Process cascade data from mutation responses
export const cascadeExchange: Exchange = ({ forward }) => ops$ => {
  return pipe(
    forward(ops$),
    map((result) => {
      // Extract cascade data and apply cache updates
      if (result.data?.cascade) {
        // Process updated entities
        // Process deleted entities
        // Process invalidations
        console.log('Cascade data received:', result.data.cascade);
      }
      return result;
    })
  );
};