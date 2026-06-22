import PropTypes from 'prop-types';
import '../../assets/css/global.scss';

const MandatoryHeader = ({ displayName }) => (
  <div className="multi-line-header">
    {displayName}{' '}
    <span className="mandatory-asterisk" style={{ color: 'red', fontSize: '18px', fontWeight: 'bold' }}>*</span>
  </div>
);
export default MandatoryHeader;

MandatoryHeader.propTypes = {
  displayName: PropTypes.string.isRequired,
};
