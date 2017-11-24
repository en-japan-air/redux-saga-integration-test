const { wire, structuredMocks } = require('../src/index');
// Library
const { fromJS } = require('immutable');
const { createSelector, createStructuredSelector } = require('reselect');
const { call, put, takeEvery } = require('redux-saga/effects');

/* Globals */
function fetch() {
  throw new Error('I don\'t expect this function to be called ever');
}
const logger = {
  log: jest.fn(),
};

/* Constants */
const STORE_DOMAIN = 'integration-test';
const LOAD = `${STORE_DOMAIN}/LOAD`;
const COMPLETE = `${STORE_DOMAIN}/COMPLETE`;

/* Actions */
function load(url) {
  return {
    type: LOAD,
    url,
  };
}
function complete(value) {
  return {
    type: COMPLETE,
    value,
  };
}

/* Reducer */
const initialState = fromJS({});

function reducer(state = initialState, action) {
  switch (action.type) {
    case LOAD:
      return state.set('loading', true);
    case COMPLETE:
      return state.set('loading', false).set('value', fromJS(action.value));
    default:
      return state;
  }
}

/* Selectors */
const selectDomain = () => (state) => state.get(STORE_DOMAIN);

const makeSelectLoading = () => createSelector(
  selectDomain(),
  (domain) => domain.get('loading')
);
const makeSelectValue = () => createSelector(
  selectDomain(),
  (domain) => domain.getIn(['value', 'result'])
);

/* Sagas */
function* doSomething(action) {
  // call to logger is not mocked
  yield call([logger, logger.log], 'do it');
  yield call(logger.log, 'please');
  // call to fetch will be mocked
  yield call(fetch, action.url);
  yield put(complete({ result: 5 }));
}
function* sagas() {
  yield takeEvery(LOAD, doSomething);
}


describe('wire components', () => {
  it('allows to mock the desired action of a fully connected component', () => {
    const mockedApi = jest.fn(() => Promise.resolve());
    const { functions } = wire({
      reducer: {
        [STORE_DOMAIN]: reducer,
      },
      sagas: [sagas],
      component: {
        mapStateToProps: createStructuredSelector({
          loading: makeSelectLoading(),
          value: makeSelectValue(),
        }),
        mapDispatchToProps: (dispatch) => ({
          load: (url) => dispatch(load(url)),
        }),
      },
      mocks: [
        [fetch, mockedApi],
      ],
    });

    return functions.load('test url').then((props) => {
      expect(props).toEqual({
        loading: false,
        value: 5,
      });
      expect(mockedApi).toHaveBeenCalledWith('test url');
      expect(logger.log).toHaveBeenCalledWith('do it');
    });
  });

  it('works for components that don\'t have a mapStateToProps', () => {
    const mockedApi = jest.fn(() => Promise.resolve());
    const { functions } = wire({
      reducer: {
        [STORE_DOMAIN]: reducer,
      },
      sagas: [sagas],
      component: {
        mapDispatchToProps: (dispatch) => ({
          load: (url) => dispatch(load(url)),
        }),
      },
      mocks: [
        [fetch, mockedApi],
      ],
    });

    return functions.load('test url').then(() => {
      expect(mockedApi).toHaveBeenCalledWith('test url');
      expect(logger.log).toHaveBeenCalledWith('do it');
    });
  });

  it('allows to test connected components without a saga', () => {
    const { props } = wire({
      component: {
        mapStateToProps: createStructuredSelector({
          value: makeSelectValue(),
        }),
      },
      initialStore: {
        [STORE_DOMAIN]: {
          value: {
            result: 10,
          },
        },
      },
    });

    expect(props()).toEqual({
      value: 10,
    });
  });

  it('handles reducers as a function', () => {
    const mockedApi = jest.fn(() => Promise.resolve());
    const { dispatch } = wire({
      reducer,
      sagas: [sagas],
      component: {
        mapStateToProps: createStructuredSelector({
          value: createSelector(
            (state) => state,
            (state) => state.getIn(['value', 'result'])
          ),
        }),
      },
      mocks: [
        [fetch, mockedApi],
      ],
    });

    return dispatch(load('test url')).then((props) => {
      expect(props).toEqual({
        value: 5,
      });
      expect(mockedApi).toHaveBeenCalledWith('test url');
      expect(logger.log).toHaveBeenCalledWith('do it');
    });
  });

  it('mocks nested objects in mapDispatchToProps', () => {
    const mockedApi = jest.fn(() => Promise.resolve());
    const { functions } = wire({
      sagas: [sagas],
      component: {
        mapDispatchToProps: (dispatch) => ({
          actions: {
            load: (url) => dispatch(load(url)),
          },
        }),
      },
      mocks: [
        [fetch, mockedApi],
      ],
    });

    return functions.actions.load('test url').then(() => {
      expect(mockedApi).toHaveBeenCalledWith('test url');
      expect(logger.log).toHaveBeenCalledWith('do it');
    });
  });

  it('allows to access props in the selector', () => {
    const { props } = wire({
      component: {
        mapStateToProps: createStructuredSelector({
          fromProps: createSelector(
            (state, ownProps) => ownProps.value,
            (value) => value
          ),
        }),
      },
      reducer,
      ownProps: {
        value: 12,
      },
    });
    expect(props()).toEqual({
      fromProps: 12,
    });
  });
});

describe('structuredMocks', () => {
  it('converts from object to array', () => {
    const original = {
      one: () => 1,
      two: () => 2,
      three: () => 3,
    };
    const mocks = {
      one: () => 'one',
      two: () => 'two',
      // ignore the missing three
    };
    expect(structuredMocks(original, mocks)).toEqual([
      [original.one, mocks.one],
      [original.two, mocks.two],
    ]);
  });
});
