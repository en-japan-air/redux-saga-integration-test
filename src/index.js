const mockedEffects = createMockedEffects();
jest.mock('redux-saga/effects', () => mockedEffects);

const { createStore, applyMiddleware } = require('redux');
const createSagaMiddleware = require('redux-saga').default;
const { combineReducers } = require('redux-immutable');
const { fromJS } = require('immutable');

function createMockedEffects() {
  const effects = require.requireActual('redux-saga/effects');

  const mocks = new Map();
  let workingStore;

  return {
    _setHooks: setHooks,
    _getStore: getStore,
    call: jest.fn(mockCall),
    take: effects.take,
    takeLatest: jest.fn(createMockTake(effects.takeLatest)),
    takeEvery: jest.fn(createMockTake(effects.takeEvery)),
    spawn: effects.spawn,
    cancel: effects.cancel,
    put: jest.fn(mockPut),
    race: effects.race,
    select: effects.select,
  };

  function setHooks(store, mockFunctions = []) {
    workingStore = store;
    setCallMocks(mockFunctions);
  }

  function getStore(errorMessage) {
    /* istanbul ignore if */
    if (!workingStore) {
      throw new Error(`Trying to ${errorMessage} but the store is not available`);
    }
    return workingStore;
  }

  function setCallMocks(mappings) {
    mappings.forEach(([fnToMock, implementation]) => mocks.set(fnToMock, implementation));
  }

  function mockCall(fn, ...args) {
    const implementation = mocks.get(fn);
    if (!implementation) {
      return Array.isArray(fn) ? fn[1].apply(fn[0], args) : fn(...args);
    }
    return implementation(...args);
  }

  function mockPut(action) {
    /* istanbul ignore else */
    if (workingStore) {
      workingStore.dispatch(action);
    }
  }

  function createMockTake(original) {
    return (type, fn, ...args) => original(type, mockCall.bind(null, fn), ...args);
  }
}

function dispatch(...args) {
  mockedEffects._getStore('dispatch an action').dispatch(...args); // eslint-disable-line no-underscore-dangle
}

const defaultOwnProps = {
  location: {
    search: '',
  },
};

function createMockedStore(reducer, sagas, initialStore, mocks) {
  const sagaMiddleware = createSagaMiddleware();
  const combinedReducer = typeof reducer === 'function' ? reducer : combineReducers(reducer);
  const store = createStore(
    combinedReducer,
    fromJS(initialStore),
    applyMiddleware(sagaMiddleware)
  );
  sagas.forEach((saga) => sagaMiddleware.run(saga));
  mockedEffects._setHooks(store, mocks); // eslint-disable-line no-underscore-dangle
  return store;
}

function wire({
  reducer = (state) => state,
  sagas = [],
  component = {},
  params,
  ownProps = defaultOwnProps,
  mocks,
  initialStore = {},
}) {
  createMockedStore(reducer, sagas, initialStore, mocks);

  return connectStateAndProps(
    component.mapStateToProps, component.mapDispatchToProps, params, ownProps
  );
}

function later(fn) {
  return new Promise((resolve) => setTimeout(resolve, 10)).then(() => fn());
}

function connectStateAndProps(mapStateToProps, mapDispatchToProps, params, ownProps) {
  const initialProps = Object.assign({}, ownProps, { params: params || ownProps.params });
  const propsGetter = mapStateToProps ?
    () => mapStateToProps(mockedEffects._getStore('get props').getState(), initialProps) : // eslint-disable-line no-underscore-dangle
    () => {};

  return {
    functions: mapDispatchToProps ? asPromise(
      mapDispatchToProps(dispatch, initialProps),
      propsGetter
    ) : {},
    dispatch: (...args) => {
      dispatch(...args);
      return later(propsGetter);
    },
    props: propsGetter,
  };
}

function asPromise(actions, props) {
  return Object.keys(actions).reduce(
    (host, key) => Object.assign(host, {
      [key]: typeof actions[key] === 'function' ? (...args) => {
        actions[key](...args);
        return later(props);
      } : asPromise(actions[key], props),
    }), {}
  );
}

function structuredMocks(originalFunctions, mocks) {
  return Object.keys(mocks).map(
    (fn) => [originalFunctions[fn], mocks[fn]]
  ).filter((mock) => mock[1]);
}

module.exports = {
  mockedEffects,
  createMockedStore,
  wire,
  structuredMocks,
};
