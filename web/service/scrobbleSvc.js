angular.module('scrobbleCast').factory('scrobbleSvc', function($http) {

  function get(url) {
    return $http.get(url)
      .then(function(result) {
        // console.log('result', result);
        return result.data;
      })
      .then(function(result) {
        // select the data portion of  the result (.podcasts||.episodes||object itself) 
        return result.episodes || result.podcasts || result;
      })
      .catch(function(error) {
        console.error('error', error);
      });
  }

  var scrobbleSvc = {
    in_progress: function() {
      return get('/data/in_progress.2014-11-07T07:10:01Z.json');
    },
    new_releases: function() {
      return get('/data/new_releases.2014-11-07T07:10:01Z.json');
    },
    podcasts: function() {
      return get('/data/podcasts.json');
    },
    history: function() {
      return get('/data/history.json');
    }
  };

  return scrobbleSvc;
});