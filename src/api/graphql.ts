import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import gql from 'graphql-tag';
import { RouteDeps } from './routes';
import { AuthService } from '../services/authService';
import { User } from '../domain/types';

/**
 * GraphQL layer providing an alternative query interface to the REST API.
 *
 * Demonstrates schema-first design with resolvers that reuse the same
 * service layer as REST — a good example of a clean middleware/business
 * layer that stays API-agnostic.
 */

const typeDefs = gql`
  scalar JSON

  type FrequencyRange { minMhz: Float!, maxMhz: Float! }

  type Device {
    id: ID!
    name: String!
    type: String!
    model: String!
    manufacturer: String!
    frequencyMhz: Float
    frequencyRange: FrequencyRange!
    status: String!
    batteryPercent: Float
    rfSignalDb: Float
    audioLevelDb: Float
    location: String
    groupId: String
    tags: [String!]!
    createdAt: String!
    updatedAt: String!
  }

  type DeviceGroup {
    id: ID!
    name: String!
    description: String
    deviceIds: [ID!]!
    createdAt: String!
  }

  type TelemetrySample {
    deviceId: ID!
    timestamp: String!
    batteryPercent: Float!
    rfSignalDb: Float!
    audioLevelDb: Float!
    interferenceDetected: Boolean!
  }

  type FrequencyAssignment { deviceId: ID!, frequencyMhz: Float! }
  type CoordinationResult {
    assignments: [FrequencyAssignment!]!
    unassigned: [ID!]!
    spacingMhz: Float!
  }

  input FrequencyRangeInput { minMhz: Float!, maxMhz: Float! }
  input CreateDeviceInput {
    name: String!
    type: String!
    model: String!
    manufacturer: String!
    frequencyRange: FrequencyRangeInput!
    location: String
    tags: [String!]
  }
  input CoordinationInput {
    deviceIds: [ID!]!
    band: FrequencyRangeInput!
    spacingMhz: Float!
    excluded: [Float!]
  }

  type Query {
    devices(type: String, groupId: ID, status: String): [Device!]!
    device(id: ID!): Device
    groups: [DeviceGroup!]!
    monitoringLatest: [TelemetrySample!]!
    health: String!
  }

  type Mutation {
    createDevice(input: CreateDeviceInput!): Device!
    deleteDevice(id: ID!): Boolean!
    coordinate(input: CoordinationInput!): CoordinationResult!
    discoverDevices(count: Int): [Device!]!
  }
`;

interface GqlContext {
  user?: { id: string; username: string; role: User['role'] };
}

function requireRole(ctx: GqlContext, roles: User['role'][]): void {
  if (!ctx.user) throw new Error('Not authenticated');
  if (!roles.includes(ctx.user.role)) throw new Error('Forbidden');
}

export async function createGraphQLMiddleware(deps: RouteDeps, authService: AuthService) {
  const resolvers = {
    Query: {
      health: () => 'ok',
      devices: (_: unknown, args: { type?: string; groupId?: string; status?: string }, ctx: GqlContext) => {
        if (!ctx.user) throw new Error('Not authenticated');
        return deps.inventory.listDevices(args);
      },
      device: (_: unknown, args: { id: string }, ctx: GqlContext) => {
        if (!ctx.user) throw new Error('Not authenticated');
        return deps.inventory.getDevice(args.id);
      },
      groups: (_: unknown, __: unknown, ctx: GqlContext) => {
        if (!ctx.user) throw new Error('Not authenticated');
        return deps.inventory.listGroups();
      },
      monitoringLatest: (_: unknown, __: unknown, ctx: GqlContext) => {
        if (!ctx.user) throw new Error('Not authenticated');
        return deps.monitoring.getAllLatest();
      },
    },
    Mutation: {
      createDevice: (_: unknown, args: { input: any }, ctx: GqlContext) => {
        requireRole(ctx, ['admin', 'operator']);
        return deps.inventory.createDevice(args.input);
      },
      deleteDevice: (_: unknown, args: { id: string }, ctx: GqlContext) => {
        requireRole(ctx, ['admin']);
        return deps.inventory.deleteDevice(args.id);
      },
      coordinate: async (_: unknown, args: { input: any }, ctx: GqlContext) => {
        requireRole(ctx, ['admin', 'operator']);
        const devices = await deps.inventory.listDevices();
        const result = deps.coordinator.coordinate(args.input, devices);
        await Promise.all(result.assignments.map((a) =>
          deps.inventory.updateDevice(a.deviceId, { frequencyMhz: a.frequencyMhz })));
        return result;
      },
      discoverDevices: (_: unknown, args: { count?: number }, ctx: GqlContext) => {
        requireRole(ctx, ['admin', 'operator']);
        return deps.inventory.simulateDiscovery(args.count ?? 3);
      },
    },
  };

  const server = new ApolloServer<GqlContext>({ typeDefs, resolvers });
  await server.start();

  return expressMiddleware(server, {
    context: async ({ req }): Promise<GqlContext> => {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) return {};
      const payload = authService.verifyToken(header.slice('Bearer '.length));
      if (!payload) return {};
      return { user: { id: payload.sub, username: payload.username, role: payload.role } };
    },
  });
}
